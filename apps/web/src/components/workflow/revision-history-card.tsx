"use client";

import { MessageSquare, RotateCcw, CheckCircle } from "lucide-react";
import type { Submission } from "@/lib/workflow-types";

type Props = {
  submissions: Submission[];
  revisionLimit: number;
  revisionCount: number;
  locale: string;
  labels: {
    title: string;
    revisionsHistory: string;
    revisionNumber: string;
    requestedBy: string;
    quotaUsed: string;
    remainingQuota: string;
    unlimitedQuota: string;
    emptyHistory: string;
  };
};

export function RevisionHistoryCard({
  submissions,
  revisionLimit,
  revisionCount,
  locale,
  labels,
}: Props) {
  // Collect all revisions across all submissions, sorted latest first
  const allRevisions = submissions.flatMap((sub) =>
    (sub.revisions || []).map((rev) => ({
      ...rev,
      submissionVersion: sub.version,
      submissionTitle: sub.title,
    })),
  ).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const remaining = Math.max(0, revisionLimit - revisionCount);

  return (
    <div className="revision-history-card card">
      <header className="revision-history-card__header">
        <div className="revision-history-card__title-group">
          <RotateCcw size={18} className="text-primary" aria-hidden="true" />
          <h3 className="revision-history-card__title">{labels.title}</h3>
        </div>

        <div className="revision-history-card__quota">
          {revisionLimit > 50 ? (
            <span className="badge badge--info">{labels.unlimitedQuota}</span>
          ) : revisionLimit > 0 ? (
            <span className="badge badge--muted">
              {labels.quotaUsed
                .replace("{used}", String(revisionCount))
                .replace("{limit}", String(revisionLimit))}
              {" • "}
              {labels.remainingQuota.replace("{remaining}", String(remaining))}
            </span>
          ) : (
            <span className="badge badge--muted">0 kuota revisi</span>
          )}
        </div>
      </header>

      {allRevisions.length === 0 ? (
        <div className="revision-history-card__empty">
          <CheckCircle size={20} className="text-success" aria-hidden="true" />
          <p>{labels.emptyHistory}</p>
        </div>
      ) : (
        <ol className="revision-history-card__list">
          {allRevisions.map((rev) => (
            <li key={rev.id} className="revision-history-item">
              <div className="revision-history-item__header">
                <div className="revision-history-item__badge-title">
                  <span className="badge badge--warning">
                    {labels.revisionNumber.replace(
                      "{number}",
                      String(rev.revision_number),
                    )}
                  </span>
                  <span className="revision-history-item__sub-ref">
                    Pengiriman #{rev.submissionVersion}: {rev.submissionTitle}
                  </span>
                </div>
                <time className="revision-history-item__time">
                  {new Date(rev.created_at).toLocaleString(locale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>

              <div className="revision-history-item__body">
                <span className="revision-history-item__requester">
                  <MessageSquare size={13} aria-hidden="true" />
                  {labels.requestedBy.replace(
                    "{name}",
                    rev.requested_by_name || "Client",
                  )}
                </span>
                <p className="revision-history-item__feedback">
                  &ldquo;{rev.feedback}&rdquo;
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
