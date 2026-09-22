package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	"github.com/creatoros/platform/apps/api/internal/workflow/domain"
	workflowservice "github.com/creatoros/platform/apps/api/internal/workflow/service"
	"github.com/go-chi/chi/v5"
)

const maxRequestBytes = 250 << 20 // 250MB for upload buffer

type Middleware func(http.Handler) http.Handler

type Handler struct {
	service *workflowservice.Service
	logger  *slog.Logger
}

type dataResponse struct {
	Data any `json:"data"`
}

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type submitRequest struct {
	Title string             `json:"title"`
	Notes string             `json:"notes"`
	Files []domain.FileInput `json:"files"`
}

type revisionRequest struct {
	Feedback string `json:"feedback"`
}

type approveRequest struct {
	Note string `json:"note"`
}

func New(service *workflowservice.Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) Mount(router chi.Router, authenticate, requireCSRF Middleware) {
	router.Group(func(protected chi.Router) {
		protected.Use(authenticate)

		protected.Get("/orders/{orderID}/submissions", h.getWorkflow)
		protected.With(requireCSRF).Post("/orders/{orderID}/submissions", h.submit)
		protected.With(requireCSRF).Post("/orders/{orderID}/submissions/{submissionID}/revision", h.requestRevision)
		protected.With(requireCSRF).Post("/orders/{orderID}/submissions/{submissionID}/approve", h.approve)
		protected.With(requireCSRF).Post("/orders/{orderID}/submissions/upload", h.uploadFile)
		protected.Get("/submissions/files/{fileID}", h.downloadFile)
	})
}

func (h *Handler) getWorkflow(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	summary, err := h.service.GetWorkflow(r.Context(), actor(r), orderID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: summary})
}

func (h *Handler) submit(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	var req submitRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	submission, err := h.service.Submit(r.Context(), actor(r), orderID, domain.SubmitInput{
		Title: req.Title,
		Notes: req.Notes,
		Files: req.Files,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: submission})
}

func (h *Handler) requestRevision(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	submissionID := chi.URLParam(r, "submissionID")
	var req revisionRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "The request body is invalid.")
		return
	}

	revision, err := h.service.RequestRevision(r.Context(), actor(r), orderID, submissionID, req.Feedback)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dataResponse{Data: revision})
}

func (h *Handler) approve(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderID")
	submissionID := chi.URLParam(r, "submissionID")
	var req approveRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = decodeJSON(w, r, &req)
	}

	submission, err := h.service.Approve(r.Context(), actor(r), orderID, submissionID, req.Note)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dataResponse{Data: submission})
}

func (h *Handler) uploadFile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	err := r.ParseMultipartForm(maxRequestBytes)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "File payload exceeds maximum limit of 200MB.")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, header, err := r.FormFile("file")
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_request", "Deliverable file is required in multipart form.")
		return
	}
	defer file.Close()

	fileInput, err := h.service.SaveUploadedFile(header.Filename, header.Header.Get("Content-Type"), file, header.Size)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, dataResponse{Data: fileInput})
}

func (h *Handler) downloadFile(w http.ResponseWriter, r *http.Request) {
	fileID := chi.URLParam(r, "fileID")
	fileInfo, diskPath, err := h.service.GetFile(r.Context(), actor(r), fileID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	diskFile, err := os.Open(diskPath)
	if err != nil {
		writeAPIError(w, http.StatusNotFound, "not_found", "Deliverable file not found on disk.")
		return
	}
	defer diskFile.Close()

	w.Header().Set("Content-Type", fileInfo.MimeType)
	w.Header().Set("Content-Disposition", "inline; filename=\""+fileInfo.FileName+"\"")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, diskFile)
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, workflowservice.ErrValidation):
		writeAPIError(w, http.StatusUnprocessableEntity, "validation_failed", err.Error())
	case errors.Is(err, workflowservice.ErrForbidden):
		writeAPIError(w, http.StatusForbidden, "forbidden", "You cannot perform this action.")
	case errors.Is(err, workflowservice.ErrNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "The workflow resource was not found.")
	case errors.Is(err, workflowservice.ErrInvalidTransition):
		writeAPIError(w, http.StatusConflict, "invalid_transition", "The submission cannot transition from its current state.")
	case errors.Is(err, workflowservice.ErrRevisionLimitExceeded):
		writeAPIError(w, http.StatusConflict, "revision_limit_exceeded", "The revision limit for this order has been reached.")
	default:
		h.logger.Error("workflow request failed", "method", r.Method, "path", r.URL.Path, "error", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "The request could not be completed.")
	}
}

func actor(r *http.Request) domain.Actor {
	session, _ := authhandler.SessionFromContext(r.Context())
	return domain.Actor{
		UserID:      session.User.ID,
		Roles:       session.User.Roles,
		Permissions: session.User.Permissions,
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	payload := errorResponse{}
	payload.Error.Code, payload.Error.Message = code, message
	writeJSON(w, status, payload)
}
