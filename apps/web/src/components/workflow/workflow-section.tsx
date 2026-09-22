"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileCheck, Layers, Loader2 } from "lucide-react";
import {
  normalizeWorkflowErrorCode,
  workflowRequest,
} from "@/lib/workflow-client";
import type { WorkflowSummary } from "@/lib/workflow-types";
import { SubmissionViewer } from "./submission-viewer";
import { SubmissionUploader } from "./submission-uploader";
import { RevisionHistoryCard } from "./revision-history-card";

type WorkflowSectionProps = {
  orderId: string;
  orderStatus: string;
  role: "client" | "creator";
  revisionLimit: number;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    revisionQuota: string;
    noRevisionLimit: string;
    noRevisionsAllowed: string;
    quotaExceeded: string;
    emptySubmissions: string;
    waitingForCreator: string;
    version: string;
    submittedAt: string;
    notes: string;
    files: string;
    download: string;
    downloadAll: string;
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
    close: string;
    uploader: {
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
    };
    creatorStatuses?: {
      pendingAcceptanceTitle?: string;
      pendingAcceptanceDesc?: string;
      revisionRequestedTitle?: string;
      revisionRequestedDesc?: string;
      waitingReviewTitle?: string;
      waitingReviewDesc?: string;
      emptyHistory?: string;
    };
    errors: Record<string, string>;
  };
  initialWorkflow?: WorkflowSummary | null;
};

export function WorkflowSection({
  orderId,
  orderStatus,
  role,
  revisionLimit,
  locale,
  labels,
  initialWorkflow = null,
}: WorkflowSectionProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<WorkflowSummary | null>(
    initialWorkflow,
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await workflowRequest<{ data: WorkflowSummary }>(
        `orders/${orderId}/submissions`,
      );
      setSummary(res.data);
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
  }, [orderId, labels.errors]);

  const handleRefresh = useCallback(() => {
    void fetchWorkflow();
    router.refresh();
  }, [fetchWorkflow, router]);

  if (loading && !summary) {
    return (
      <section className="workflow-section shell-loading">
        <div className="loading-spinner-wrap">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      </section>
    );
  }

  const submissions = summary?.submissions ?? [];
  const revisionCount = summary?.revision_count ?? 0;
  const remaining = Math.max(0, revisionLimit - revisionCount);

  // Creator can upload if order is in_progress and either:
  // - No submissions yet
  // - Latest submission has status 'revision_requested'
  const latestSubmission = submissions.length > 0 ? submissions[0] : null;
  const canCreatorUpload =
    role === "creator" &&
    (orderStatus === "in_progress" || orderStatus === "accepted") &&
    (!latestSubmission || latestSubmission.status === "revision_requested");

  let quotaText = "";
  if (revisionLimit > 0) {
    quotaText = labels.revisionQuota
      .replace("{used}", String(revisionCount))
      .replace("{limit}", String(revisionLimit))
      .replace("{remaining}", String(remaining));
  } else {
    quotaText = labels.noRevisionsAllowed;
  }

  return (
    <section className="workflow-section">
      <header className="workflow-section__header">
        <div className="workflow-section__title-group">
          <div className="workflow-section__icon-title">
            <FileCheck size={24} className="text-primary" />
            <h2>{labels.title}</h2>
          </div>
          <p className="workflow-section__subtitle">{labels.subtitle}</p>
        </div>

        <div className="workflow-section__quota-badge">
          <Layers size={15} />
          <span>{quotaText}</span>
        </div>
      </header>

      {errorMessage ? (
        <div className="form-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="btn btn--outline btn--sm ml-auto"
            onClick={fetchWorkflow}
          >
            Retry
          </button>
        </div>
      ) : null}

      {role === "creator" && orderStatus === "pending_acceptance" ? (
        <div className="creator-upload-status-card">
          <AlertCircle size={18} className="text-warning shrink-0" />
          <div>
            <h4>{labels.creatorStatuses?.pendingAcceptanceTitle ?? "Pesanan Menunggu Konfirmasi"}</h4>
            <p>{labels.creatorStatuses?.pendingAcceptanceDesc ?? "Terima pesanan ini terlebih dahulu untuk memulai pengerjaan dan mengaktifkan fitur unggah hasil karya."}</p>
          </div>
        </div>
      ) : null}

      {role === "creator" && !canCreatorUpload && latestSubmission?.status === "submitted" ? (
        <div className="creator-upload-status-card creator-upload-status-card--waiting">
          <FileCheck size={18} className="text-info shrink-0" />
          <div>
            <h4>{labels.creatorStatuses?.waitingReviewTitle ?? "Konten Sedang Ditinjau Klien"}</h4>
            <p>{labels.creatorStatuses?.waitingReviewDesc ?? "Pengiriman hasil karya Anda telah berhasil dikirim. Anda dapat mengunggah revisi jika klien mengajukan permintaan revisi."}</p>
          </div>
        </div>
      ) : null}

      {canCreatorUpload ? (
        <div className="workflow-section__uploader">
          {latestSubmission?.status === "revision_requested" ? (
            <div className="creator-upload-status-card creator-upload-status-card--revision">
              <AlertCircle size={18} className="text-warning shrink-0" />
              <div>
                <h4>{labels.creatorStatuses?.revisionRequestedTitle ?? "Klien Meminta Revisi Konten"}</h4>
                <p>{labels.creatorStatuses?.revisionRequestedDesc ?? "Silakan periksa umpan balik di bawah dan unggah berkas konten perbaikan."}</p>
              </div>
            </div>
          ) : null}
          <SubmissionUploader
            orderId={orderId}
            onSuccess={handleRefresh}
            labels={{
              ...labels.uploader,
              errors: labels.errors,
            }}
          />
        </div>
      ) : null}

      <div className="workflow-section__submissions">
        <SubmissionViewer
          orderId={orderId}
          orderStatus={orderStatus}
          role={role}
          submissions={submissions}
          revisionLimit={revisionLimit}
          revisionCount={revisionCount}
          locale={locale}
          onRefresh={handleRefresh}
          labels={{
            emptySubmissions: labels.emptySubmissions,
            waitingForCreator: labels.waitingForCreator,
            version: labels.version,
            submittedAt: labels.submittedAt,
            notes: labels.notes,
            files: labels.files,
            download: labels.download,
            videoPreview: labels.videoPreview,
            imagePreview: labels.imagePreview,
            fileSize: labels.fileSize,
            statuses: labels.statuses,
            revisionsHistory: labels.revisionsHistory,
            revisionNumber: labels.revisionNumber,
            requestedBy: labels.requestedBy,
            requestRevision: labels.requestRevision,
            approveSubmission: labels.approveSubmission,
            approveConfirmTitle: labels.approveConfirmTitle,
            approveConfirmBody: labels.approveConfirmBody,
            approveNotePlaceholder: labels.approveNotePlaceholder,
            approving: labels.approving,
            confirmApprove: labels.confirmApprove,
            revisionModalTitle: labels.revisionModalTitle,
            revisionModalBody: labels.revisionModalBody,
            revisionFeedbackPlaceholder: labels.revisionFeedbackPlaceholder,
            requestingRevision: labels.requestingRevision,
            confirmRequestRevision: labels.confirmRequestRevision,
            cancel: labels.cancel,
            quotaExceeded: labels.quotaExceeded,
            errors: labels.errors,
          }}
        />
      </div>

      <RevisionHistoryCard
        submissions={submissions}
        revisionLimit={revisionLimit}
        revisionCount={revisionCount}
        locale={locale}
        labels={{
          title: labels.revisionsHistory,
          revisionsHistory: labels.revisionsHistory,
          revisionNumber: labels.revisionNumber,
          requestedBy: labels.requestedBy,
          quotaUsed: labels.revisionQuota,
          remainingQuota: "sisa {remaining}",
          unlimitedQuota: labels.noRevisionLimit,
          emptyHistory: labels.creatorStatuses?.emptyHistory ?? "Belum ada riwayat revisi pada pesanan ini.",
        }}
      />
    </section>
  );
}
