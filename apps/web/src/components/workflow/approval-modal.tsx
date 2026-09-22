"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  normalizeWorkflowErrorCode,
  workflowRequest,
} from "@/lib/workflow-client";
import type { Submission } from "@/lib/workflow-types";

type ApprovalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  submissionId: string;
  onSuccess: () => void;
  labels: {
    title: string;
    body: string;
    notePlaceholder: string;
    submitAction: string;
    submitting: string;
    cancel: string;
    errors: Record<string, string>;
  };
};

export function ApprovalModal({
  isOpen,
  onClose,
  orderId,
  submissionId,
  onSuccess,
  labels,
}: ApprovalModalProps) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      await workflowRequest<{ data: Submission }>(
        `orders/${orderId}/submissions/${submissionId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ note: note.trim() }),
        },
      );
      setNote("");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "unknown_error";
      const normalized = normalizeWorkflowErrorCode(code);
      setErrorMessage(labels.errors[normalized] ?? labels.errors.unknown_error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h2 id="approval-modal-title" className="modal-title text-success">
              <CheckCircle2 size={18} aria-hidden="true" />
              {labels.title}
            </h2>
            <p className="modal-subtitle">{labels.body}</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label={labels.cancel}
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage ? (
          <div className="form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="approval-note" className="sr-only">
              {labels.title}
            </label>
            <textarea
              id="approval-note"
              className="form-textarea"
              rows={3}
              placeholder={labels.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              disabled={loading}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={loading}
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              className="btn btn--success"
              disabled={loading}
            >
              {loading ? labels.submitting : labels.submitAction}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
