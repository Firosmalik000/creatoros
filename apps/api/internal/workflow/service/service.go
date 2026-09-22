package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/creatoros/platform/apps/api/internal/workflow/domain"
)

var (
	ErrValidation            = errors.New("workflow validation failed")
	ErrForbidden             = errors.New("forbidden")
	ErrNotFound              = errors.New("not found")
	ErrInvalidTransition     = errors.New("invalid transition")
	ErrRevisionLimitExceeded = errors.New("revision limit exceeded")
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const MaxFileSizeBytes = 200 * 1024 * 1024 // 200 MB

var allowedMimeTypes = map[string]bool{
	"video/mp4":        true,
	"video/quicktime":  true,
	"video/webm":       true,
	"image/jpeg":       true,
	"image/png":        true,
	"image/webp":       true,
	"application/pdf":  true,
	"application/zip":  true,
}

type Service struct {
	repository domain.Repository
	uploadDir  string
	now        func() time.Time
}

func New(repository domain.Repository, uploadDir string) *Service {
	if uploadDir == "" {
		uploadDir = "./uploads/deliverables"
	}
	_ = os.MkdirAll(uploadDir, 0755)

	return &Service{
		repository: repository,
		uploadDir:  uploadDir,
		now:        func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) UploadDir() string {
	return s.uploadDir
}

func (s *Service) SaveUploadedFile(filename, mimeType string, r io.Reader, sizeBytes int64) (domain.FileInput, error) {
	if sizeBytes <= 0 || sizeBytes > MaxFileSizeBytes {
		return domain.FileInput{}, fmt.Errorf("%w: file size exceeds 200MB limit", ErrValidation)
	}

	cleanMime := strings.ToLower(strings.TrimSpace(mimeType))
	if !allowedMimeTypes[cleanMime] {
		return domain.FileInput{}, fmt.Errorf("%w: unsupported mime type %s", ErrValidation, cleanMime)
	}

	cleanFilename := filepath.Base(filename)
	if cleanFilename == "." || cleanFilename == "/" || cleanFilename == "" {
		cleanFilename = "deliverable"
	}

	ext := filepath.Ext(cleanFilename)
	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	uniqueName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), hex.EncodeToString(tokenBytes), ext)
	targetPath := filepath.Join(s.uploadDir, uniqueName)

	out, err := os.Create(targetPath)
	if err != nil {
		return domain.FileInput{}, fmt.Errorf("create deliverable file on disk: %w", err)
	}
	defer out.Close()

	written, err := io.Copy(out, r)
	if err != nil {
		_ = os.Remove(targetPath)
		return domain.FileInput{}, fmt.Errorf("write deliverable file: %w", err)
	}

	return domain.FileInput{
		FilePath:  uniqueName,
		FileName:  cleanFilename,
		MimeType:  cleanMime,
		SizeBytes: written,
	}, nil
}

func (s *Service) Submit(ctx context.Context, actor domain.Actor, orderID string, input domain.SubmitInput) (domain.Submission, error) {
	if !hasAnyPermission(actor, "content.submit", "orders.manage", "creator.services.manage") {
		return domain.Submission{}, ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.Submission{}, ErrNotFound
	}

	input.Title = strings.TrimSpace(input.Title)
	titleLen := utf8.RuneCountInString(input.Title)
	if titleLen < 3 || titleLen > 150 {
		return domain.Submission{}, fmt.Errorf("%w: submission title must be between 3 and 150 characters", ErrValidation)
	}

	input.Notes = strings.TrimSpace(input.Notes)
	if utf8.RuneCountInString(input.Notes) > 3000 {
		return domain.Submission{}, fmt.Errorf("%w: submission notes cannot exceed 3000 characters", ErrValidation)
	}

	if len(input.Files) == 0 {
		return domain.Submission{}, fmt.Errorf("%w: at least one deliverable file is required", ErrValidation)
	}

	for _, f := range input.Files {
		if f.FilePath == "" || f.FileName == "" {
			return domain.Submission{}, fmt.Errorf("%w: invalid file deliverable record", ErrValidation)
		}
		if !allowedMimeTypes[f.MimeType] {
			return domain.Submission{}, fmt.Errorf("%w: unsupported file mime type: %s", ErrValidation, f.MimeType)
		}
	}

	sub, err := s.repository.CreateSubmission(ctx, actor.UserID, orderID, input, s.now())
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.Submission{}, ErrNotFound
	case errors.Is(err, domain.ErrForbidden):
		return domain.Submission{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.Submission{}, ErrInvalidTransition
	case err != nil:
		return domain.Submission{}, fmt.Errorf("submit deliverables: %w", err)
	default:
		return sub, nil
	}
}

func (s *Service) GetWorkflow(ctx context.Context, actor domain.Actor, orderID string) (domain.WorkflowSummary, error) {
	isCreator := hasAnyPermission(actor, "content.submit", "orders.manage", "creator.services.manage")
	isClient := hasAnyPermission(actor, "content.review", "orders.create", "marketplace.purchase")

	if !isCreator && !isClient {
		return domain.WorkflowSummary{}, ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	if !uuidPattern.MatchString(orderID) {
		return domain.WorkflowSummary{}, ErrNotFound
	}

	summary, err := s.repository.GetWorkflow(ctx, actor.UserID, orderID, isCreator)
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.WorkflowSummary{}, ErrNotFound
	case errors.Is(err, domain.ErrForbidden):
		return domain.WorkflowSummary{}, ErrForbidden
	case err != nil:
		return domain.WorkflowSummary{}, fmt.Errorf("get workflow summary: %w", err)
	default:
		return summary, nil
	}
}

func (s *Service) RequestRevision(ctx context.Context, actor domain.Actor, orderID, submissionID, feedback string) (domain.SubmissionRevision, error) {
	if !hasAnyPermission(actor, "content.review", "orders.create", "marketplace.purchase") {
		return domain.SubmissionRevision{}, ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	submissionID = strings.TrimSpace(submissionID)
	if !uuidPattern.MatchString(orderID) || !uuidPattern.MatchString(submissionID) {
		return domain.SubmissionRevision{}, ErrNotFound
	}

	feedback = strings.TrimSpace(feedback)
	feedbackLen := utf8.RuneCountInString(feedback)
	if feedbackLen < 10 || feedbackLen > 3000 {
		return domain.SubmissionRevision{}, fmt.Errorf("%w: feedback must be between 10 and 3000 characters", ErrValidation)
	}

	rev, err := s.repository.RequestRevision(ctx, actor.UserID, orderID, submissionID, feedback, s.now())
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.SubmissionRevision{}, ErrNotFound
	case errors.Is(err, domain.ErrForbidden):
		return domain.SubmissionRevision{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.SubmissionRevision{}, ErrInvalidTransition
	case errors.Is(err, domain.ErrRevisionLimitExceeded):
		return domain.SubmissionRevision{}, ErrRevisionLimitExceeded
	case err != nil:
		return domain.SubmissionRevision{}, fmt.Errorf("request revision: %w", err)
	default:
		return rev, nil
	}
}

func (s *Service) Approve(ctx context.Context, actor domain.Actor, orderID, submissionID, note string) (domain.Submission, error) {
	if !hasAnyPermission(actor, "content.review", "orders.create", "marketplace.purchase") {
		return domain.Submission{}, ErrForbidden
	}

	orderID = strings.TrimSpace(orderID)
	submissionID = strings.TrimSpace(submissionID)
	if !uuidPattern.MatchString(orderID) || !uuidPattern.MatchString(submissionID) {
		return domain.Submission{}, ErrNotFound
	}

	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > 1000 {
		return domain.Submission{}, fmt.Errorf("%w: note cannot exceed 1000 characters", ErrValidation)
	}

	sub, err := s.repository.Approve(ctx, actor.UserID, orderID, submissionID, note, s.now())
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return domain.Submission{}, ErrNotFound
	case errors.Is(err, domain.ErrForbidden):
		return domain.Submission{}, ErrForbidden
	case errors.Is(err, domain.ErrInvalidTransition):
		return domain.Submission{}, ErrInvalidTransition
	case err != nil:
		return domain.Submission{}, fmt.Errorf("approve submission: %w", err)
	default:
		return sub, nil
	}
}

func (s *Service) GetFile(ctx context.Context, actor domain.Actor, fileID string) (domain.SubmissionFile, string, error) {
	isCreator := hasAnyPermission(actor, "content.submit", "orders.manage", "creator.services.manage")
	isClient := hasAnyPermission(actor, "content.review", "orders.create", "marketplace.purchase")

	if !isCreator && !isClient {
		return domain.SubmissionFile{}, "", ErrForbidden
	}

	fileID = strings.TrimSpace(fileID)
	if !uuidPattern.MatchString(fileID) {
		return domain.SubmissionFile{}, "", ErrNotFound
	}

	file, err := s.repository.GetFile(ctx, actor.UserID, fileID, isCreator)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.SubmissionFile{}, "", ErrNotFound
	}
	if err != nil {
		return domain.SubmissionFile{}, "", fmt.Errorf("query deliverable file: %w", err)
	}

	fullDiskPath := filepath.Join(s.uploadDir, file.FilePath)
	return file, fullDiskPath, nil
}

func hasAnyPermission(actor domain.Actor, perms ...string) bool {
	for _, perm := range perms {
		for _, actorPerm := range actor.Permissions {
			if actorPerm == perm {
				return true
			}
		}
	}
	return false
}
