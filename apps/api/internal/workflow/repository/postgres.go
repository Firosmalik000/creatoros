package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/creatoros/platform/apps/api/internal/workflow/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) CreateSubmission(ctx context.Context, creatorUserID, orderID string, input domain.SubmitInput, now time.Time) (domain.Submission, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("begin create submission tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var (
		currentStatus string
		orderCreator  string
	)
	err = tx.QueryRow(ctx, `
		SELECT status, creator_user_id
		FROM orders
		WHERE id = $1
		FOR UPDATE
	`, orderID).Scan(&currentStatus, &orderCreator)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Submission{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Submission{}, fmt.Errorf("check order for submission: %w", err)
	}

	if orderCreator != creatorUserID {
		return domain.Submission{}, domain.ErrForbidden
	}

	if currentStatus != "accepted" && currentStatus != "in_progress" {
		return domain.Submission{}, domain.ErrInvalidTransition
	}

	var nextVersion int
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(version), 0) + 1
		FROM order_submissions
		WHERE order_id = $1
	`, orderID).Scan(&nextVersion)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("calculate next submission version: %w", err)
	}

	var submissionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO order_submissions (order_id, version, creator_user_id, title, notes, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'submitted', $6, $6)
		RETURNING id
	`, orderID, nextVersion, creatorUserID, input.Title, input.Notes, now).Scan(&submissionID)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("insert order submission: %w", err)
	}

	savedFiles := make([]domain.SubmissionFile, 0, len(input.Files))
	for _, f := range input.Files {
		var fileID string
		err = tx.QueryRow(ctx, `
			INSERT INTO submission_files (submission_id, file_path, file_name, mime_type, size_bytes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, submissionID, f.FilePath, f.FileName, f.MimeType, f.SizeBytes, now).Scan(&fileID)
		if err != nil {
			return domain.Submission{}, fmt.Errorf("insert submission file: %w", err)
		}
		savedFiles = append(savedFiles, domain.SubmissionFile{
			ID:           fileID,
			SubmissionID: submissionID,
			FilePath:     f.FilePath,
			FileName:     f.FileName,
			MimeType:     f.MimeType,
			SizeBytes:    f.SizeBytes,
			CreatedAt:    now,
		})
	}

	if currentStatus == "accepted" {
		_, err = tx.Exec(ctx, `
			UPDATE orders
			SET status = 'in_progress', updated_at = $2
			WHERE id = $1
		`, orderID, now)
		if err != nil {
			return domain.Submission{}, fmt.Errorf("update order in_progress: %w", err)
		}
	}

	eventNote := fmt.Sprintf("Deliverable v%d submitted: %s", nextVersion, input.Title)
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, 'in_progress', $4, $5)
	`, orderID, creatorUserID, currentStatus, eventNote, now)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("insert submission event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Submission{}, fmt.Errorf("commit submission tx: %w", err)
	}

	var creatorName string
	_ = r.pool.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, creatorUserID).Scan(&creatorName)

	return domain.Submission{
		ID:            submissionID,
		OrderID:       orderID,
		Version:       nextVersion,
		CreatorUserID: creatorUserID,
		CreatorName:   creatorName,
		Title:         input.Title,
		Notes:         input.Notes,
		Status:        domain.SubmissionStatusSubmitted,
		Files:         savedFiles,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

func (r *Postgres) GetWorkflow(ctx context.Context, actorID, orderID string, isCreator bool) (domain.WorkflowSummary, error) {
	var (
		orderStatus   string
		revisionLimit int
		query         string
	)

	if isCreator {
		query = "SELECT status, revision_limit FROM orders WHERE id = $1 AND creator_user_id = $2"
	} else {
		query = "SELECT status, revision_limit FROM orders WHERE id = $1 AND client_user_id = $2"
	}

	err := r.pool.QueryRow(ctx, query, orderID, actorID).Scan(&orderStatus, &revisionLimit)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.WorkflowSummary{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.WorkflowSummary{}, fmt.Errorf("query order for workflow: %w", err)
	}

	var revisionsUsed int
	err = r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM submission_revisions WHERE order_id = $1
	`, orderID).Scan(&revisionsUsed)
	if err != nil {
		return domain.WorkflowSummary{}, fmt.Errorf("count revisions: %w", err)
	}

	subRows, err := r.pool.Query(ctx, `
		SELECT s.id, s.order_id, s.version, s.creator_user_id, u.display_name, s.title, s.notes, s.status, s.created_at, s.updated_at
		FROM order_submissions s
		JOIN users u ON u.id = s.creator_user_id
		WHERE s.order_id = $1
		ORDER BY s.version ASC
	`, orderID)
	if err != nil {
		return domain.WorkflowSummary{}, fmt.Errorf("query submissions: %w", err)
	}
	defer subRows.Close()

	submissions := make([]domain.Submission, 0)
	for subRows.Next() {
		var s domain.Submission
		err := subRows.Scan(
			&s.ID,
			&s.OrderID,
			&s.Version,
			&s.CreatorUserID,
			&s.CreatorName,
			&s.Title,
			&s.Notes,
			&s.Status,
			&s.CreatedAt,
			&s.UpdatedAt,
		)
		if err != nil {
			return domain.WorkflowSummary{}, fmt.Errorf("scan submission: %w", err)
		}
		submissions = append(submissions, s)
	}
	if err := subRows.Err(); err != nil {
		return domain.WorkflowSummary{}, err
	}

	for i := range submissions {
		files, err := r.loadFiles(ctx, submissions[i].ID)
		if err != nil {
			return domain.WorkflowSummary{}, err
		}
		submissions[i].Files = files

		revisions, err := r.loadRevisions(ctx, submissions[i].ID)
		if err != nil {
			return domain.WorkflowSummary{}, err
		}
		submissions[i].Revisions = revisions
	}

	rem := revisionLimit - revisionsUsed
	if rem < 0 {
		rem = 0
	}

	return domain.WorkflowSummary{
		OrderID:            orderID,
		OrderStatus:        orderStatus,
		RevisionLimit:      revisionLimit,
		RevisionsUsed:      revisionsUsed,
		RevisionsRemaining: rem,
		Submissions:        submissions,
	}, nil
}

func (r *Postgres) RequestRevision(ctx context.Context, clientUserID, orderID, submissionID, feedback string, now time.Time) (domain.SubmissionRevision, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("begin request revision tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var (
		orderStatus   string
		revisionLimit int
	)
	err = tx.QueryRow(ctx, `
		SELECT status, revision_limit
		FROM orders
		WHERE id = $1 AND client_user_id = $2
		FOR UPDATE
	`, orderID, clientUserID).Scan(&orderStatus, &revisionLimit)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SubmissionRevision{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("check order for revision: %w", err)
	}

	var used int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM submission_revisions WHERE order_id = $1
	`, orderID).Scan(&used)
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("check used revisions: %w", err)
	}

	if used >= revisionLimit {
		return domain.SubmissionRevision{}, domain.ErrRevisionLimitExceeded
	}

	var (
		subStatus string
		version   int
	)
	err = tx.QueryRow(ctx, `
		SELECT status, version
		FROM order_submissions
		WHERE id = $1 AND order_id = $2
		FOR UPDATE
	`, submissionID, orderID).Scan(&subStatus, &version)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SubmissionRevision{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("check submission for revision: %w", err)
	}

	if subStatus != domain.SubmissionStatusSubmitted {
		return domain.SubmissionRevision{}, domain.ErrInvalidTransition
	}

	_, err = tx.Exec(ctx, `
		UPDATE order_submissions
		SET status = 'revision_requested', updated_at = $2
		WHERE id = $1
	`, submissionID, now)
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("update submission status: %w", err)
	}

	nextRev := used + 1
	var revID string
	err = tx.QueryRow(ctx, `
		INSERT INTO submission_revisions (submission_id, order_id, client_user_id, revision_number, feedback, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, submissionID, orderID, clientUserID, nextRev, feedback, now).Scan(&revID)
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("insert revision: %w", err)
	}

	eventNote := fmt.Sprintf("Revision #%d requested on submission v%d: %s", nextRev, version, feedback)
	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, $3, $4, $5)
	`, orderID, clientUserID, orderStatus, eventNote, now)
	if err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("insert revision event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.SubmissionRevision{}, fmt.Errorf("commit revision tx: %w", err)
	}

	var clientName string
	_ = r.pool.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, clientUserID).Scan(&clientName)

	return domain.SubmissionRevision{
		ID:             revID,
		SubmissionID:   submissionID,
		OrderID:        orderID,
		ClientUserID:   clientUserID,
		ClientName:     clientName,
		RevisionNumber: nextRev,
		Feedback:       feedback,
		CreatedAt:      now,
	}, nil
}

func (r *Postgres) Approve(ctx context.Context, clientUserID, orderID, submissionID, note string, now time.Time) (domain.Submission, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("begin approve tx: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	var orderStatus string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM orders
		WHERE id = $1 AND client_user_id = $2
		FOR UPDATE
	`, orderID, clientUserID).Scan(&orderStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Submission{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Submission{}, fmt.Errorf("check order for approve: %w", err)
	}

	var (
		subStatus string
		version   int
	)
	err = tx.QueryRow(ctx, `
		SELECT status, version
		FROM order_submissions
		WHERE id = $1 AND order_id = $2
		FOR UPDATE
	`, submissionID, orderID).Scan(&subStatus, &version)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Submission{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Submission{}, fmt.Errorf("check submission for approve: %w", err)
	}

	if subStatus != domain.SubmissionStatusSubmitted {
		return domain.Submission{}, domain.ErrInvalidTransition
	}

	_, err = tx.Exec(ctx, `
		UPDATE order_submissions
		SET status = 'approved', updated_at = $2
		WHERE id = $1
	`, submissionID, now)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("update submission approved: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET status = 'completed', updated_at = $2
		WHERE id = $1
	`, orderID, now)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("update order completed: %w", err)
	}

	eventNote := fmt.Sprintf("Submission v%d approved by client. Order marked as completed.", version)
	if note != "" {
		eventNote = fmt.Sprintf("%s Note: %s", eventNote, note)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO order_events (order_id, actor_user_id, from_status, to_status, note, created_at)
		VALUES ($1, $2, $3, 'completed', $4, $5)
	`, orderID, clientUserID, orderStatus, eventNote, now)
	if err != nil {
		return domain.Submission{}, fmt.Errorf("insert approval event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Submission{}, fmt.Errorf("commit approve tx: %w", err)
	}

	return r.loadSingleSubmission(ctx, submissionID)
}

func (r *Postgres) GetFile(ctx context.Context, actorID, fileID string, isCreator bool) (domain.SubmissionFile, error) {
	var query string
	if isCreator {
		query = `
			SELECT sf.id, sf.submission_id, sf.file_path, sf.file_name, sf.mime_type, sf.size_bytes, sf.created_at
			FROM submission_files sf
			JOIN order_submissions os ON os.id = sf.submission_id
			JOIN orders o ON o.id = os.order_id
			WHERE sf.id = $1 AND o.creator_user_id = $2
		`
	} else {
		query = `
			SELECT sf.id, sf.submission_id, sf.file_path, sf.file_name, sf.mime_type, sf.size_bytes, sf.created_at
			FROM submission_files sf
			JOIN order_submissions os ON os.id = sf.submission_id
			JOIN orders o ON o.id = os.order_id
			WHERE sf.id = $1 AND o.client_user_id = $2
		`
	}

	var f domain.SubmissionFile
	err := r.pool.QueryRow(ctx, query, fileID, actorID).Scan(
		&f.ID,
		&f.SubmissionID,
		&f.FilePath,
		&f.FileName,
		&f.MimeType,
		&f.SizeBytes,
		&f.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SubmissionFile{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.SubmissionFile{}, fmt.Errorf("load submission file: %w", err)
	}
	return f, nil
}

func (r *Postgres) loadFiles(ctx context.Context, submissionID string) ([]domain.SubmissionFile, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, submission_id, file_path, file_name, mime_type, size_bytes, created_at
		FROM submission_files
		WHERE submission_id = $1
		ORDER BY created_at ASC
	`, submissionID)
	if err != nil {
		return nil, fmt.Errorf("query files: %w", err)
	}
	defer rows.Close()

	files := make([]domain.SubmissionFile, 0)
	for rows.Next() {
		var f domain.SubmissionFile
		if err := rows.Scan(&f.ID, &f.SubmissionID, &f.FilePath, &f.FileName, &f.MimeType, &f.SizeBytes, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, f)
	}
	return files, rows.Err()
}

func (r *Postgres) loadRevisions(ctx context.Context, submissionID string) ([]domain.SubmissionRevision, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT r.id, r.submission_id, r.order_id, r.client_user_id, u.display_name, r.revision_number, r.feedback, r.created_at
		FROM submission_revisions r
		JOIN users u ON u.id = r.client_user_id
		WHERE r.submission_id = $1
		ORDER BY r.revision_number ASC
	`, submissionID)
	if err != nil {
		return nil, fmt.Errorf("query revisions: %w", err)
	}
	defer rows.Close()

	revisions := make([]domain.SubmissionRevision, 0)
	for rows.Next() {
		var rev domain.SubmissionRevision
		if err := rows.Scan(&rev.ID, &rev.SubmissionID, &rev.OrderID, &rev.ClientUserID, &rev.ClientName, &rev.RevisionNumber, &rev.Feedback, &rev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan revision: %w", err)
		}
		revisions = append(revisions, rev)
	}
	return revisions, rows.Err()
}

func (r *Postgres) loadSingleSubmission(ctx context.Context, submissionID string) (domain.Submission, error) {
	var s domain.Submission
	err := r.pool.QueryRow(ctx, `
		SELECT s.id, s.order_id, s.version, s.creator_user_id, u.display_name, s.title, s.notes, s.status, s.created_at, s.updated_at
		FROM order_submissions s
		JOIN users u ON u.id = s.creator_user_id
		WHERE s.id = $1
	`, submissionID).Scan(
		&s.ID,
		&s.OrderID,
		&s.Version,
		&s.CreatorUserID,
		&s.CreatorName,
		&s.Title,
		&s.Notes,
		&s.Status,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Submission{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Submission{}, fmt.Errorf("load single submission: %w", err)
	}

	files, err := r.loadFiles(ctx, s.ID)
	if err != nil {
		return domain.Submission{}, err
	}
	s.Files = files

	revisions, err := r.loadRevisions(ctx, s.ID)
	if err != nil {
		return domain.Submission{}, err
	}
	s.Revisions = revisions

	return s, nil
}
