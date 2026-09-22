"use client";

import { useState } from "react";
import type { Payment } from "@/lib/payment-types";
import {
  payOrder,
  releaseOrderEscrow,
  normalizePaymentErrorCode,
} from "@/lib/payment-client";

type Props = {
  orderID: string;
  initialPayment: Payment | null;
  /** The client's user ID — only client can pay and release */
  clientUserID: string;
  /** Current authenticated user ID */
  currentUserID: string;
  locale: string;
  labels: {
    payNow: string;
    payOrder: string;
    paymentMethod: string;
    simulated: string;
    paying: string;
    paySuccess: string;
    payError: string;
    alreadyPaid: string;
    releaseEscrow: string;
    releasing: string;
    releaseSuccess: string;
    releaseError: string;
    status: {
      pending: string;
      escrow_held: string;
      released: string;
      refunded: string;
      failed: string;
    };
  };
  currencyLocale?: string;
};

function formatMinor(minor: number, currency: string, locale: string): string {
  const divisor = currency === "IDR" ? 1 : 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(minor / divisor);
}

export function OrderPaymentCard({
  orderID,
  initialPayment,
  clientUserID,
  currentUserID,
  locale,
  labels,
}: Props) {
  const [payment, setPayment] = useState<Payment | null>(initialPayment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isClient = currentUserID === clientUserID;

  async function handlePay() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const p = await payOrder(orderID, "simulated");
      setPayment(p);
      setSuccess(labels.paySuccess);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = normalizePaymentErrorCode(err?.code ?? "unknown_error");
      if (code === "already_paid" || code === "conflict") {
        setError(labels.alreadyPaid);
      } else {
        setError(labels.payError);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const p = await releaseOrderEscrow(orderID);
      setPayment(p);
      setSuccess(labels.releaseSuccess);
    } catch {
      setError(labels.releaseError);
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = payment
    ? (labels.status[payment.status] ?? payment.status)
    : null;

  const statusClass: Record<string, string> = {
    pending: "payment-status-pending",
    escrow_held: "payment-status-escrow",
    released: "payment-status-released",
    refunded: "payment-status-refunded",
    failed: "payment-status-failed",
  };

  return (
    <section className="payment-card" aria-label={labels.payOrder}>
      {payment ? (
        <div className="payment-card__info">
          <p className="payment-card__amount">
            {formatMinor(payment.amount_minor, payment.currency, locale)}
          </p>
          <span
            className={`payment-card__status ${statusClass[payment.status] ?? ""}`}
            aria-label={statusLabel ?? payment.status}
          >
            {statusLabel}
          </span>
        </div>
      ) : null}

      {success && (
        <p className="payment-card__success" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="payment-card__error" role="alert">
          {error}
        </p>
      )}

      {isClient && !payment && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handlePay}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? labels.paying : labels.payNow}
        </button>
      )}

      {isClient &&
        payment?.status === "escrow_held" && (
          <button
            type="button"
            className="btn btn-success"
            onClick={handleRelease}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? labels.releasing : labels.releaseEscrow}
          </button>
        )}
    </section>
  );
}
