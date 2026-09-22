"use client";

import { useState, useRef } from "react";
import {
  AlertCircle,
  FileUp,
  Loader2,
  Trash2,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import {
  normalizeWorkflowErrorCode,
  uploadDeliverable,
  workflowRequest,
} from "@/lib/workflow-client";
import type { Submission, SubmitFileInput } from "@/lib/workflow-types";

type SubmissionUploaderProps = {
  orderId: string;
  onSuccess: () => void;
  labels: {
    title: string;
    titleLabel: string;
    titlePlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    uploadFile: string;
    dragDrop: string;
    supportedFormats: string;
    uploading: string;
    uploadSuccess: string;
    removeFile: string;
    submitButton: string;
    submitting: string;
    noFilesSelected: string;
    errors: Record<string, string>;
  };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionUploader({
  orderId,
  onSuccess,
  labels,
}: SubmissionUploaderProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<SubmitFileInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.size > 200 * 1024 * 1024) {
          throw { code: "file_too_large" };
        }
        const uploaded = await uploadDeliverable(orderId, file);
        setFiles((prev) => [
          ...prev,
          {
            file_path: uploaded.file_path,
            file_name: uploaded.file_name,
            mime_type: uploaded.mime_type,
            file_size_bytes: uploaded.file_size_bytes,
          },
        ]);
      }
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "unknown_error";
      const normalized = normalizeWorkflowErrorCode(code);
      setErrorMessage(labels.errors[normalized] ?? labels.errors.unknown_error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setErrorMessage(labels.errors.validation_failed);
      return;
    }
    if (files.length === 0) {
      setErrorMessage(labels.noFilesSelected);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await workflowRequest<{ data: Submission }>(
        `orders/${orderId}/submissions`,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            notes: notes.trim(),
            files,
          }),
        },
      );
      setTitle("");
      setNotes("");
      setFiles([]);
      onSuccess();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "unknown_error";
      const normalized = normalizeWorkflowErrorCode(code);
      setErrorMessage(labels.errors[normalized] ?? labels.errors.unknown_error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="workflow-uploader card">
      <header className="workflow-uploader__header">
        <FileUp size={20} className="text-primary" />
        <h3>{labels.title}</h3>
      </header>

      {errorMessage ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="workflow-uploader__form">
        <div className="form-group">
          <label htmlFor="deliverable-title" className="form-label">
            {labels.titleLabel} *
          </label>
          <input
            id="deliverable-title"
            type="text"
            className="form-input"
            placeholder={labels.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={160}
            required
            disabled={submitting || uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="deliverable-notes" className="form-label">
            {labels.notesLabel}
          </label>
          <textarea
            id="deliverable-notes"
            className="form-textarea"
            rows={3}
            placeholder={labels.notesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            disabled={submitting || uploading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{labels.uploadFile} *</label>
          <div
            className={`file-dropzone ${uploading ? "file-dropzone--uploading" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,application/pdf,application/zip"
              onChange={handleFileChange}
              disabled={uploading || submitting}
            />
            {uploading ? (
              <div className="file-dropzone__status">
                <Loader2 className="animate-spin" size={24} />
                <span>{labels.uploading}</span>
              </div>
            ) : (
              <div className="file-dropzone__content">
                <UploadCloud size={32} className="text-muted" />
                <p className="file-dropzone__prompt">{labels.dragDrop}</p>
                <span className="file-dropzone__hints">
                  {labels.supportedFormats}
                </span>
              </div>
            )}
          </div>
        </div>

        {files.length > 0 ? (
          <div className="workflow-uploader__file-list">
            <span className="file-list-heading">
              <CheckCircle2 size={16} className="text-success" />
              {labels.uploadSuccess} ({files.length}):
            </span>
            <ul className="file-list">
              {files.map((file, idx) => (
                <li key={file.file_path} className="file-list__item">
                  <div className="file-list__info">
                    <span className="file-name">{file.file_name}</span>
                    <span className="file-meta">
                      {formatBytes(file.file_size_bytes)} • {file.mime_type}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="file-remove-btn"
                    onClick={() => handleRemoveFile(idx)}
                    disabled={submitting}
                    title={labels.removeFile}
                    aria-label={`${labels.removeFile} ${file.file_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="workflow-uploader__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={
              submitting ||
              uploading ||
              title.trim().length < 3 ||
              files.length === 0
            }
          >
            {submitting ? labels.submitting : labels.submitButton}
          </button>
        </div>
      </form>
    </section>
  );
}
