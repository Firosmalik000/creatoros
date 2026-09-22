"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import type { Submission, SubmissionFile } from "@/lib/workflow-types";
import { RevisionModal } from "./revision-modal";
import { ApprovalModal } from "./approval-modal";

type SubmissionViewerProps = {
  orderId: string;
  orderStatus: string;
  role: "client" | "creator";
  submissions: Submission[];
  revisionLimit: number;
  revisionCount: number;
  locale: string;
  onRefresh: () => void;
  labels: {
    emptySubmissions: string;
    waitingForCreator: string;
    version: string;
    submittedAt: string;
    notes: string;
    files: string;
    download: string;
    videoPreview: string;
    imagePreview: string;
    fileSize: string;
    statuses: {
      submitted: string;
      revision_requested: string;
      approved: string;
    };
    revisionsHistory: string;
    revisionNumber: string;
    requestedBy: string;
    requestRevision: string;
    approveSubmission: string;
    approveConfirmTitle: string;
    approveConfirmBody: string;
    approveNotePlaceholder: string;
    approving: string;
    confirmApprove: string;
    revisionModalTitle: string;
    revisionModalBody: string;
    revisionFeedbackPlaceholder: string;
    requestingRevision: string;
    confirmRequestRevision: string;
    cancel: string;
    quotaExceeded: string;
    errors: Record<string, string>;
  };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionViewer({
  orderId,
  orderStatus,
  role,
  submissions,
  revisionLimit,
  revisionCount,
  locale,
  onRefresh,
  labels,
}: SubmissionViewerProps) {
  const [activeRevisionSubmissionId, setActiveRevisionSubmissionId] = useState<
    string | null
  >(null);
  const [activeApproveSubmissionId, setActiveApproveSubmissionId] = useState<
    string | null
  >(null);

  if (submissions.length === 0) {
    return (
      <div className="workflow-empty card">
        <Clock size={36} className="text-muted" />
        <h4>{labels.emptySubmissions}</h4>
        <p>{labels.waitingForCreator}</p>
      </div>
    );
  }

  const remainingRevisions = Math.max(0, revisionLimit - revisionCount);
  const canClientReview =
    role === "client" &&
    orderStatus !== "completed" &&
    orderStatus !== "cancelled" &&
    orderStatus !== "declined";

  const renderFilePreview = (file: SubmissionFile) => {
    const isVideo = file.mime_type.startsWith("video/");
    const isImage = file.mime_type.startsWith("image/");
    const downloadUrl = `/api/workflow/submissions/files/${file.id}`;

    return (
      <div key={file.id} className="submission-file-card">
        <div className="submission-file-card__header">
          <div className="file-icon-wrap">
            {isVideo ? (
              <Film size={18} className="text-primary" />
            ) : isImage ? (
              <ImageIcon size={18} className="text-primary" />
            ) : (
              <FileText size={18} className="text-muted" />
            )}
            <span className="file-title">{file.file_name}</span>
          </div>
          <a
            href={downloadUrl}
            download={file.file_name}
            className="btn btn--outline btn--sm download-btn"
          >
            <Download size={14} />
            <span>{labels.download}</span> ({formatBytes(file.file_size_bytes)})
          </a>
        </div>

        {isVideo ? (
          <div className="submission-file-card__preview">
            <video
              controls
              className="deliverable-video"
              src={downloadUrl}
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
          </div>
        ) : isImage ? (
          <div className="submission-file-card__preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={downloadUrl}
              alt={file.file_name}
              className="deliverable-image"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="submissions-list">
      {submissions.map((sub, idx) => {
        const isLatest = idx === 0;
        const statusBadgeClass =
          sub.status === "approved"
            ? "badge--success"
            : sub.status === "revision_requested"
              ? "badge--warning"
              : "badge--info";

        return (
          <article key={sub.id} className="submission-card card">
            <header className="submission-card__header">
              <div>
                <div className="submission-card__title-row">
                  <span className="submission-version">
                    {labels.version.replace("{version}", String(sub.version))}
                  </span>
                  <span className={`badge ${statusBadgeClass}`}>
                    {labels.statuses[sub.status] ?? sub.status}
                  </span>
                </div>
                <h4 className="submission-title">{sub.title}</h4>
                <time className="submission-date">
                  {labels.submittedAt.replace(
                    "{date}",
                    new Date(sub.created_at).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  )}
                </time>
              </div>

              {canClientReview && isLatest && sub.status === "submitted" ? (
                <div className="submission-card__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setActiveRevisionSubmissionId(sub.id)}
                    disabled={remainingRevisions <= 0}
                    title={
                      remainingRevisions <= 0 ? labels.quotaExceeded : undefined
                    }
                  >
                    <RefreshCw size={14} />
                    {labels.requestRevision}
                  </button>
                  <button
                    type="button"
                    className="btn btn--success btn--sm"
                    onClick={() => setActiveApproveSubmissionId(sub.id)}
                  >
                    <CheckCircle2 size={14} />
                    {labels.approveSubmission}
                  </button>
                </div>
              ) : null}
            </header>

            {sub.notes ? (
              <div className="submission-notes">
                <span className="submission-notes__label">{labels.notes}:</span>
                <p>{sub.notes}</p>
              </div>
            ) : null}

            <div className="submission-files">
              <span className="submission-files__label">
                {labels.files} ({sub.files.length}):
              </span>
              <div className="submission-files__grid">
                {sub.files.map((file) => renderFilePreview(file))}
              </div>
            </div>

            {sub.revisions && sub.revisions.length > 0 ? (
              <div className="submission-revisions">
                <span className="submission-revisions__title">
                  <MessageSquare size={16} />
                  {labels.revisionsHistory} ({sub.revisions.length}):
                </span>
                <ul className="revisions-list">
                  {sub.revisions.map((rev) => (
                    <li key={rev.id} className="revision-item">
                      <div className="revision-item__header">
                        <strong>
                          {labels.revisionNumber.replace(
                            "{number}",
                            String(rev.revision_number),
                          )}
                        </strong>
                        <span className="revision-item__meta">
                          {labels.requestedBy.replace(
                            "{name}",
                            rev.requested_by_name || "Client",
                          )}{" "}
                          •{" "}
                          {new Date(rev.created_at).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="revision-item__feedback">{rev.feedback}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        );
      })}

      {activeRevisionSubmissionId ? (
        <RevisionModal
          isOpen={Boolean(activeRevisionSubmissionId)}
          onClose={() => setActiveRevisionSubmissionId(null)}
          orderId={orderId}
          submissionId={activeRevisionSubmissionId}
          revisionCount={revisionCount}
          revisionLimit={revisionLimit}
          onSuccess={onRefresh}
          labels={{
            title: labels.revisionModalTitle,
            body: labels.revisionModalBody,
            placeholder: labels.revisionFeedbackPlaceholder,
            quotaLabel:
              revisionLimit > 0
                ? `Revisions used: ${revisionCount} of ${revisionLimit} (${remainingRevisions} remaining)`
                : "Unlimited revisions",
            submitAction: labels.confirmRequestRevision,
            submitting: labels.requestingRevision,
            cancel: labels.cancel,
            errors: labels.errors,
          }}
        />
      ) : null}

      {activeApproveSubmissionId ? (
        <ApprovalModal
          isOpen={Boolean(activeApproveSubmissionId)}
          onClose={() => setActiveApproveSubmissionId(null)}
          orderId={orderId}
          submissionId={activeApproveSubmissionId}
          onSuccess={onRefresh}
          labels={{
            title: labels.approveConfirmTitle,
            body: labels.approveConfirmBody,
            notePlaceholder: labels.approveNotePlaceholder,
            submitAction: labels.confirmApprove,
            submitting: labels.approving,
            cancel: labels.cancel,
            errors: labels.errors,
          }}
        />
      ) : null}
    </div>
  );
}
