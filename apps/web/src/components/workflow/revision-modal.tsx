"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import {
  normalizeWorkflowErrorCode,
  workflowRequest,
} from "@/lib/workflow-client";
import type { Submission } from "@/lib/workflow-types";

type RevisionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  submissionId: string;
  revisionCount: number;
  revisionLimit: number;
  onSuccess: () => void;
  labels: {
    title: string;
    body: string;
    placeholder: string;
    quotaLabel: string;
    submitAction: string;
    submitting: string;
    cancel: string;
    errors: Record<string, string>;
  };
};

export function RevisionModal({
  isOpen,
  onClose,
  orderId,
  submissionId,
  revisionCount,
  revisionLimit,
  onSuccess,
  labels,
}: RevisionModalProps) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const remaining = Math.max(0, revisionLimit - revisionCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim().length < 10) {
      setErrorMessage(labels.errors.validation_failed);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await workflowRequest<{ data: Submission }>(
        `orders/${orderId}/submissions/${submissionId}/revision`,
        {
          method: "POST",
          body: JSON.stringify({ feedback: feedback.trim() }),
        },
      );
      setFeedback("");
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
      aria-labelledby="revision-modal-title"
    >
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h2 id="revision-modal-title" className="modal-title">
              <RefreshCw size={18} aria-hidden="true" />
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

        <div className="modal-quota-badge">
          <span>{labels.quotaLabel}</span>
        </div>

        {errorMessage ? (
          <div className="form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="revision-feedback" className="sr-only">
              {labels.title}
            </label>
            <textarea
              id="revision-feedback"
              className="form-textarea"
              rows={5}
              placeholder={labels.placeholder}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              minLength={10}
              maxLength={2000}
              required
              disabled={loading}
            />
            <div className="form-char-count">
              {feedback.length} / 2000 characters (min 10)
            </div>
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
              className="btn btn--primary"
              disabled={
                loading || feedback.trim().length < 10 || remaining <= 0
              }
            >
              {loading ? labels.submitting : labels.submitAction}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
