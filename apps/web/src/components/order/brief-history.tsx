"use client";

import { useState, useTransition } from "react";
import { History, Send, LoaderCircle } from "lucide-react";
import type { BriefVersion } from "@/lib/order-types";
import { orderRequest, normalizeOrderErrorCode } from "@/lib/order-client";
import type { ApiError } from "@/lib/auth-client";

type Labels = {
  title: string;
  versionLabel: string;
  submittedBy: string;
  submitNewBrief: string;
  briefPlaceholder: string;
  submitAction: string;
  submitting: string;
  charCount: string;
  success: string;
  errors: Record<string, string>;
};

type Props = {
  orderId: string;
  initialBriefs: BriefVersion[];
  canEdit: boolean;
  locale: string;
  labels: Labels;
};

export function BriefHistory({
  orderId,
  initialBriefs,
  canEdit,
  locale,
  labels,
}: Props) {
  const [briefs, setBriefs] = useState<BriefVersion[]>(initialBriefs);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (content.trim().length < 20) {
      setError(
        labels.errors.validation_failed ||
          "Brief must be at least 20 characters.",
      );
      return;
    }

    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await orderRequest<{ data: BriefVersion }>(
          `orders/${orderId}/briefs`,
          {
            method: "POST",
            body: JSON.stringify({ content: content.trim() }),
          },
        );
        setBriefs((prev) => [...prev, res.data]);
        setContent("");
        setSuccess(true);
      } catch (caught) {
        const err = caught as ApiError;
        const normalized = normalizeOrderErrorCode(err.code);
        setError(
          labels.errors[normalized] || err.message || "Failed to submit brief.",
        );
      }
    });
  }

  return (
    <section className="brief-history">
      <div className="brief-history__header">
        <h3 className="brief-history__title">
          <History size={18} aria-hidden="true" />
          {labels.title}
        </h3>
      </div>

      <div className="brief-history__list">
        {briefs.map((b) => (
          <div key={b.id} className="brief-item">
            <div className="brief-item__meta">
              <span className="brief-item__version">
                {labels.versionLabel.replace("{version}", String(b.version))}
              </span>
              <span className="brief-item__date">
                {new Date(b.created_at).toLocaleString(locale)}
              </span>
            </div>
            {b.submitted_by_name ? (
              <span className="brief-item__author">
                {labels.submittedBy}: {b.submitted_by_name}
              </span>
            ) : null}
            <p className="brief-item__content">{b.content}</p>
          </div>
        ))}
      </div>

      {canEdit ? (
        <form className="brief-form" onSubmit={handleSubmit}>
          <h4>{labels.submitNewBrief}</h4>

          {error ? (
            <div className="form-status form-status--error" role="alert">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="form-status form-status--success" role="status">
              {labels.success}
            </div>
          ) : null}

          <div className="brief-form__field">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={labels.briefPlaceholder}
              rows={4}
              disabled={isPending}
              minLength={20}
              maxLength={5000}
              required
            />
            <span className="brief-form__count">
              {labels.charCount.replace("{count}", String(content.length))}
            </span>
          </div>

          <button
            type="submit"
            className="button button--signal"
            disabled={isPending || content.trim().length < 20}
          >
            {isPending ? (
              <>
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
                {labels.submitting}
              </>
            ) : (
              <>
                <Send size={16} aria-hidden="true" />
                {labels.submitAction}
              </>
            )}
          </button>
        </form>
      ) : null}
    </section>
  );
}
