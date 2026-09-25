import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, RefreshCw, Calendar } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BriefHistory } from "@/components/order/brief-history";
import { OrderActions } from "@/components/order/order-actions";
import { OrderStatusBadge } from "@/components/order/order-status-badge";
import { OrderTimeline } from "@/components/order/order-timeline";
import { OrderProgressTracker } from "@/components/order/order-progress-tracker";
import { OrderDetailTabs } from "@/components/order/order-detail-tabs";
import { WorkflowSection } from "@/components/workflow/workflow-section";
import { OrderPaymentCard } from "@/components/payment/order-payment-card";
import { OrderConversation } from "@/components/communication/order-conversation";
import type { AppLocale } from "@/i18n/routing";
import { getClientOrderDetail } from "@/lib/order-server";
import { getOrderWorkflow } from "@/lib/workflow-server";
import { getOrderPayment } from "@/lib/payment-server";
import { getServerOrderThread } from "@/lib/communication-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: AppLocale; orderID: string }>;
};

export default async function ClientOrderDetailPage({ params }: PageProps) {
  const { locale, orderID } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  if (!cookieStore.get("creatoros_session")) {
    redirect(`/${locale}/auth/login?redirect=/${locale}/orders/${orderID}`);
  }

  const [detail, workflow, payment, thread] = await Promise.all([
    getClientOrderDetail(orderID),
    getOrderWorkflow(orderID),
    getOrderPayment(orderID),
    getServerOrderThread(orderID),
  ]);
  if (!detail) notFound();

  const [t, wt, pt, ct] = await Promise.all([
    getTranslations({ locale, namespace: "Order" }),
    getTranslations({ locale, namespace: "Workflow" }),
    getTranslations({ locale, namespace: "Payment" }),
    getTranslations({ locale, namespace: "Chat" }),
  ]);

  const formattedPrice = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: detail.currency,
    maximumFractionDigits: detail.currency === "IDR" ? 0 : 2,
  }).format(detail.price_minor / (detail.currency === "IDR" ? 1 : 100));

  const statusLabel = t(`statuses.${detail.status}`);

  const canEditBrief =
    detail.status === "pending_acceptance" ||
    detail.status === "accepted" ||
    detail.status === "in_progress";

  const submissions = workflow?.submissions ?? [];
  const hasSubmissions = submissions.length > 0;
  const revisionsUsed = workflow?.revision_count ?? 0;
  const hasRevisions = revisionsUsed > 0;

  return (
    <div className="space-y-5">
      <Link
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        href={`/${locale}/orders`}
      >
        <ArrowLeft aria-hidden="true" size={16} /> {t("backToOrders")}
      </Link>

      <main id="main-content" className="order-detail-page">
        {/* Compact, clean header */}
        <header className="order-detail-header">
          <div>
            <span className="order-detail-header__number break-all">
              {t("orderNumber")}: {detail.id}
            </span>
            <h1>{detail.service_title || detail.package_name}</h1>
            <p className="order-detail-header__creator">
              {t("creator")}: <strong>{detail.creator_display_name}</strong>
            </p>
          </div>
          <div className="order-detail-header__status">
            <OrderStatusBadge status={detail.status} label={statusLabel} />
          </div>
        </header>

        {/* Visual Progress Stepper & Deadline Bar */}
        <OrderProgressTracker
          orderStatus={detail.status}
          deliveryDays={detail.delivery_days}
          createdAt={detail.created_at}
          acceptedAt={detail.accepted_at}
          deadlineAt={detail.deadline_at}
          hasSubmissions={hasSubmissions}
          hasRevisions={hasRevisions}
          revisionLimit={detail.revision_limit}
          revisionsUsed={revisionsUsed}
          locale={locale}
          labels={{
            steps: {
              placed: t("tracker.steps.placed"),
              accepted: t("tracker.steps.accepted"),
              inProgress: t("tracker.steps.inProgress"),
              review: t("tracker.steps.review"),
              completed: t("tracker.steps.completed"),
            },
            daysRunning: t.raw("tracker.daysRunning") as string,
            deliveryTime: t("tracker.deliveryTime"),
            deadline: t("tracker.deadline"),
            noDeadline: t("tracker.noDeadline"),
            statusOnTrack: t.raw("tracker.statusOnTrack") as string,
            statusDueToday: t("tracker.statusDueToday"),
            statusOverdue: t.raw("tracker.statusOverdue") as string,
            statusCompleted: t("tracker.statusCompleted"),
            revisionsCount: t.raw("tracker.revisionsCount") as string,
            unlimitedRevisions: t("tracker.unlimitedRevisions"),
            noRevisions: t("tracker.noRevisions"),
          }}
        />

        {/* 2-Column Responsive Grid */}
        <div className="order-detail-grid">
          {/* Main Area with Clean Tabs */}
          <div className="order-detail-main">
            <OrderDetailTabs
              labels={{
                deliverables: t("tabs.deliverables"),
                discussion: t("tabs.discussion"),
                brief: t("tabs.brief"),
                deliverablesCount: submissions.length,
                messagesCount: thread?.messages?.length,
              }}
              deliverablesContent={
                <WorkflowSection
                  orderId={detail.id}
                  orderStatus={detail.status}
                  role="client"
                  revisionLimit={detail.revision_limit}
                  locale={locale}
                  initialWorkflow={workflow}
                  labels={{
                    title: wt("title"),
                    subtitle: wt("subtitle"),
                    revisionQuota: wt.raw("revisionQuota") as string,
                    noRevisionLimit: wt.raw("noRevisionLimit") as string,
                    noRevisionsAllowed: wt("noRevisionsAllowed"),
                    quotaExceeded: wt("quotaExceeded"),
                    emptySubmissions: wt("emptySubmissions"),
                    waitingForCreator: wt("waitingForCreator"),
                    version: wt.raw("version") as string,
                    submittedAt: wt.raw("submittedAt") as string,
                    notes: wt("notes"),
                    files: wt("files"),
                    download: wt("download"),
                    downloadAll: wt("downloadAll"),
                    videoPreview: wt("videoPreview"),
                    imagePreview: wt("imagePreview"),
                    fileSize: wt.raw("fileSize") as string,
                    statuses: {
                      submitted: wt("statuses.submitted"),
                      revision_requested: wt("statuses.revision_requested"),
                      approved: wt("statuses.approved"),
                    },
                    revisionsHistory: wt("revisionsHistory"),
                    revisionNumber: wt.raw("revisionNumber") as string,
                    requestedBy: wt.raw("requestedBy") as string,
                    requestRevision: wt("requestRevision"),
                    approveSubmission: wt("approveSubmission"),
                    approveConfirmTitle: wt("approveConfirmTitle"),
                    approveConfirmBody: wt("approveConfirmBody"),
                    approveNotePlaceholder: wt("approveNotePlaceholder"),
                    approving: wt("approving"),
                    confirmApprove: wt("confirmApprove"),
                    revisionModalTitle: wt("revisionModalTitle"),
                    revisionModalBody: wt("revisionModalBody"),
                    revisionFeedbackPlaceholder: wt("revisionFeedbackPlaceholder"),
                    requestingRevision: wt("requestingRevision"),
                    confirmRequestRevision: wt("confirmRequestRevision"),
                    cancel: wt("cancel"),
                    close: wt("close"),
                    uploader: {
                      title: wt("uploader.title"),
                      titleLabel: wt("uploader.titleLabel"),
                      titlePlaceholder: wt("uploader.titlePlaceholder"),
                      notesLabel: wt("uploader.notesLabel"),
                      notesPlaceholder: wt("uploader.notesPlaceholder"),
                      uploadFile: wt("uploader.uploadFile"),
                      dragDrop: wt("uploader.dragDrop"),
                      supportedFormats: wt("uploader.supportedFormats"),
                      uploading: wt("uploader.uploading"),
                      uploadSuccess: wt("uploader.uploadSuccess"),
                      removeFile: wt("uploader.removeFile"),
                      submitButton: wt("uploader.submitButton"),
                      submitting: wt("uploader.submitting"),
                      noFilesSelected: wt("uploader.noFilesSelected"),
                    },
                    creatorStatuses: {
                      pendingAcceptanceTitle: wt("creatorStatuses.pendingAcceptanceTitle"),
                      pendingAcceptanceDesc: wt("creatorStatuses.pendingAcceptanceDesc"),
                      revisionRequestedTitle: wt("creatorStatuses.revisionRequestedTitle"),
                      revisionRequestedDesc: wt("creatorStatuses.revisionRequestedDesc"),
                      waitingReviewTitle: wt("creatorStatuses.waitingReviewTitle"),
                      waitingReviewDesc: wt("creatorStatuses.waitingReviewDesc"),
                      emptyHistory: wt("creatorStatuses.emptyHistory"),
                    },
                    errors: {
                      invalid_request: wt("errors.invalid_request"),
                      validation_failed: wt("errors.validation_failed"),
                      forbidden: wt("errors.forbidden"),
                      not_found: wt("errors.not_found"),
                      invalid_transition: wt("errors.invalid_transition"),
                      revision_limit_exceeded: wt("errors.revision_limit_exceeded"),
                      file_too_large: wt("errors.file_too_large"),
                      unsupported_media_type: wt("errors.unsupported_media_type"),
                      service_unavailable: wt("errors.service_unavailable"),
                      unknown_error: wt("errors.unknown_error"),
                    },
                  }}
                />
              }
              discussionContent={
                <OrderConversation
                  orderID={detail.id}
                  currentUserID={detail.client_user_id}
                  initialThread={thread}
                  locale={locale}
                  labels={{
                    title: ct("title"),
                    placeholder: ct("placeholder"),
                    send: ct("send"),
                    sending: ct("sending"),
                    empty: ct("empty"),
                    error: ct("error"),
                    loadError: ct("loadError"),
                  }}
                />
              }
              briefContent={
                <>
                  <section className="order-spec">
                    <h2>{t("packageDetails")}</h2>
                    <div className="order-spec__package">
                      <h3>{detail.package_name}</h3>
                      {detail.package_description ? (
                        <p>{detail.package_description}</p>
                      ) : null}
                    </div>

                    <dl className="order-spec__meta">
                      <div>
                        <dt>
                          <Clock3 size={15} aria-hidden="true" /> {t("delivery")}
                        </dt>
                        <dd>{t("deliveryDays", { count: detail.delivery_days })}</dd>
                      </div>
                      <div>
                        <dt>
                          <RefreshCw size={15} aria-hidden="true" /> {t("revisions")}
                        </dt>
                        <dd>
                          {t("revisionValue", { count: detail.revision_limit })}
                        </dd>
                      </div>
                      {detail.deadline_at ? (
                        <div>
                          <dt>
                            <Calendar size={15} aria-hidden="true" /> {t("deadline")}
                          </dt>
                          <dd>
                            {new Date(detail.deadline_at).toLocaleDateString(locale)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="order-spec__price-row">
                      <span>{t("totalPrice")}</span>
                      <strong>{formattedPrice}</strong>
                    </div>
                  </section>

                  <BriefHistory
                    orderId={detail.id}
                    initialBriefs={detail.briefs}
                    canEdit={canEditBrief}
                    locale={locale}
                    labels={{
                      title: t("briefs.title"),
                      versionLabel: t.raw("briefs.versionLabel") as string,
                      submittedBy: t("briefs.submittedBy"),
                      submitNewBrief: t("briefs.submitNewBrief"),
                      briefPlaceholder: t("briefs.placeholder"),
                      submitAction: t("briefs.submitAction"),
                      submitting: t("briefs.submitting"),
                      charCount: t.raw("briefs.charCount") as string,
                      success: t("briefs.success"),
                      errors: {
                        validation_failed: t("errors.validation_failed"),
                        forbidden: t("errors.forbidden"),
                        not_found: t("errors.not_found"),
                        invalid_transition: t("errors.invalid_transition"),
                        unknown_error: t("errors.unknown_error"),
                      },
                    }}
                  />
                </>
              }
            />
          </div>

          {/* Sidebar */}
          <aside className="order-detail-sidebar space-y-6">
            {/* Sidebar Order Summary */}
            <section className="order-spec">
              <h2>{t("packageDetails")}</h2>
              <div className="order-spec__package">
                <h3>{detail.package_name}</h3>
              </div>
              <div className="order-spec__price-row pt-3">
                <span>{t("totalPrice")}</span>
                <strong>{formattedPrice}</strong>
              </div>

              <OrderActions
                orderId={detail.id}
                status={detail.status}
                role="client"
                labels={{
                  acceptAction: t("actions.accept"),
                  declineAction: t("actions.decline"),
                  cancelAction: t("actions.cancel"),
                  notePlaceholder: t("actions.notePlaceholder"),
                  confirmPrompt: t("actions.confirmPrompt"),
                  processing: t("actions.processing"),
                  errors: {
                    invalid_request: t("errors.invalid_request"),
                    forbidden: t("errors.forbidden"),
                    not_found: t("errors.not_found"),
                    invalid_transition: t("errors.invalid_transition"),
                    unknown_error: t("errors.unknown_error"),
                  },
                }}
              />
            </section>

            <OrderPaymentCard
              orderID={detail.id}
              initialPayment={payment}
              clientUserID={detail.client_user_id}
              currentUserID={detail.client_user_id}
              locale={locale}
              labels={{
                payNow: pt("payNow"),
                payOrder: pt("payOrder"),
                paymentMethod: pt("paymentMethod"),
                simulated: pt("simulated"),
                paying: pt("paying"),
                paySuccess: pt("paySuccess"),
                payError: pt("payError"),
                alreadyPaid: pt("alreadyPaid"),
                releaseEscrow: pt("releaseEscrow"),
                releasing: pt("releasing"),
                releaseSuccess: pt("releaseSuccess"),
                releaseError: pt("releaseError"),
                status: {
                  pending: pt("status.pending"),
                  escrow_held: pt("status.escrow_held"),
                  released: pt("status.released"),
                  refunded: pt("status.refunded"),
                  failed: pt("status.failed"),
                },
              }}
            />

            <OrderTimeline
              events={detail.events}
              locale={locale}
              labels={{
                title: t("timeline.title"),
                empty: t("timeline.empty"),
                statuses: {
                  pending_acceptance: t("statuses.pending_acceptance"),
                  accepted: t("statuses.accepted"),
                  declined: t("statuses.declined"),
                  in_progress: t("statuses.in_progress"),
                  completed: t("statuses.completed"),
                  cancelled: t("statuses.cancelled"),
                  disputed: t("statuses.disputed"),
                },
              }}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
