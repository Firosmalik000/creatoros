"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban, LoaderCircle } from "lucide-react";
import type { OrderStatus } from "@/lib/order-types";
import { orderRequest, normalizeOrderErrorCode } from "@/lib/order-client";
import type { ApiError } from "@/lib/auth-client";

type Labels = {
  acceptAction: string;
  declineAction: string;
  cancelAction: string;
  notePlaceholder: string;
  confirmPrompt: string;
  processing: string;
  errors: Record<string, string>;
};

type Props = {
  orderId: string;
  status: OrderStatus;
  role: "client" | "creator";
  labels: Labels;
};

export function OrderActions({ orderId, status, role, labels }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [activeModal, setActiveModal] = useState<
    "accept" | "decline" | "cancel" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCreatorDecide =
    role === "creator" && status === "pending_acceptance";
  const canCancel =
    (role === "client" || role === "creator") &&
    (status === "pending_acceptance" || status === "accepted");

  if (!canCreatorDecide && !canCancel) {
    return null;
  }

  function handleAction(action: "accept" | "decline" | "cancel") {
    setError(null);
    startTransition(async () => {
      try {
        let endpoint = `orders/${orderId}/cancel`;
        if (action === "accept") endpoint = `creator/orders/${orderId}/accept`;
        if (action === "decline")
          endpoint = `creator/orders/${orderId}/decline`;

        await orderRequest(endpoint, {
          method: "POST",
          body: JSON.stringify({ note: note.trim() }),
        });
        setActiveModal(null);
        setNote("");
        router.refresh();
      } catch (caught) {
        const err = caught as ApiError;
        const normalized = normalizeOrderErrorCode(err.code);
        setError(labels.errors[normalized] || err.message || "Action failed.");
      }
    });
  }

  return (
    <div className="order-actions">
      {error ? (
        <div className="form-status form-status--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="order-actions__buttons">
        {canCreatorDecide ? (
          <>
            <button
              type="button"
              className="button button--signal"
              onClick={() => setActiveModal("accept")}
              disabled={isPending}
            >
              <Check size={16} aria-hidden="true" /> {labels.acceptAction}
            </button>
            <button
              type="button"
              className="button button--quiet order-actions__decline"
              onClick={() => setActiveModal("decline")}
              disabled={isPending}
            >
              <X size={16} aria-hidden="true" /> {labels.declineAction}
            </button>
          </>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            className="button button--quiet order-actions__cancel"
            onClick={() => setActiveModal("cancel")}
            disabled={isPending}
          >
            <Ban size={16} aria-hidden="true" /> {labels.cancelAction}
          </button>
        ) : null}
      </div>

      {activeModal ? (
        <div className="order-modal-backdrop" role="dialog" aria-modal="true">
          <div className="order-modal">
            <h4>
              {activeModal === "accept" && labels.acceptAction}
              {activeModal === "decline" && labels.declineAction}
              {activeModal === "cancel" && labels.cancelAction}
            </h4>
            <p>{labels.confirmPrompt}</p>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={labels.notePlaceholder}
              rows={3}
              maxLength={1000}
              disabled={isPending}
            />

            <div className="order-modal__actions">
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setActiveModal(null);
                  setError(null);
                }}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`button ${activeModal === "accept" ? "button--signal" : "button--dark"}`}
                onClick={() => handleAction(activeModal)}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <LoaderCircle
                      className="spin"
                      size={16}
                      aria-hidden="true"
                    />
                    {labels.processing}
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
