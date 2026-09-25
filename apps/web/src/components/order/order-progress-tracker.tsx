"use client";

import {
  CheckCircle2,
  Clock3,
  Calendar,
  AlertCircle,
  FileEdit,
  Send,
  Flag,
  RotateCcw,
} from "lucide-react";
import type { OrderStatus } from "@/lib/order-types";

export type TrackerLabels = {
  steps: {
    placed: string;
    accepted: string;
    inProgress: string;
    review: string;
    completed: string;
  };
  daysRunning: string;
  deliveryTime: string;
  deadline: string;
  noDeadline: string;
  statusOnTrack: string;
  statusDueToday: string;
  statusOverdue: string;
  statusCompleted: string;
  revisionsCount: string;
  unlimitedRevisions: string;
  noRevisions: string;
};

type Props = {
  orderStatus: OrderStatus;
  deliveryDays: number;
  createdAt: string;
  acceptedAt?: string | null;
  deadlineAt?: string | null;
  hasSubmissions?: boolean;
  hasRevisions?: boolean;
  revisionLimit: number;
  revisionsUsed: number;
  locale: string;
  labels: TrackerLabels;
};

export function OrderProgressTracker({
  orderStatus,
  deliveryDays,
  createdAt,
  acceptedAt,
  deadlineAt,
  hasSubmissions = false,
  hasRevisions = false,
  revisionLimit,
  revisionsUsed,
  locale,
  labels,
}: Props) {
  // 1. Calculate milestone step states (1 to 5)
  // Step 1: Placed (always done)
  // Step 2: Accepted (done if accepted, in_progress, completed, or if has submissions)
  // Step 3: In Progress (in progress / production)
  // Step 4: Review / Revision (active when deliverable submitted or revisions requested)
  // Step 5: Completed (active when status is completed)

  const isTerminated =
    orderStatus === "cancelled" ||
    orderStatus === "declined" ||
    orderStatus === "disputed";
  const isCompleted = orderStatus === "completed";

  let currentStepIndex = 1;
  if (orderStatus === "completed") {
    currentStepIndex = 5;
  } else if (hasSubmissions || hasRevisions) {
    currentStepIndex = 4;
  } else if (orderStatus === "in_progress") {
    currentStepIndex = 3;
  } else if (orderStatus === "accepted") {
    currentStepIndex = 2;
  } else {
    currentStepIndex = 1;
  }

  const steps = [
    { id: 1, label: labels.steps.placed, icon: FileEdit },
    { id: 2, label: labels.steps.accepted, icon: CheckCircle2 },
    { id: 3, label: labels.steps.inProgress, icon: Clock3 },
    { id: 4, label: labels.steps.review, icon: Send },
    { id: 5, label: labels.steps.completed, icon: Flag },
  ];

  // 2. Calculate running days & deadline
  const startDate = acceptedAt ? new Date(acceptedAt) : new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const rawElapsed = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(1, rawElapsed);

  const safeTotalDays = Math.max(1, deliveryDays);
  const progressPct = Math.min(100, Math.round((elapsedDays / safeTotalDays) * 100));

  let deadlineStatus: "on_track" | "due_today" | "overdue" | "completed" =
    "on_track";
  let remainingDays = 0;
  let formattedDeadline = "";

  if (isCompleted) {
    deadlineStatus = "completed";
  } else if (deadlineAt) {
    const deadline = new Date(deadlineAt);
    formattedDeadline = deadline.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const remainMs = deadline.getTime() - now.getTime();
    remainingDays = Math.ceil(remainMs / (1000 * 60 * 60 * 24));
    if (remainingDays < 0) {
      deadlineStatus = "overdue";
    } else if (remainingDays === 0) {
      deadlineStatus = "due_today";
    } else {
      deadlineStatus = "on_track";
    }
  }

  // 3. Revisions text
  let revisionsText = "";
  if (revisionLimit <= 0) {
    revisionsText = labels.noRevisions;
  } else if (revisionLimit > 50) {
    revisionsText = labels.unlimitedRevisions;
  } else {
    revisionsText = labels.revisionsCount
      .replace("{used}", String(revisionsUsed))
      .replace("{limit}", String(revisionLimit));
  }

  return (
    <section className="order-progress-tracker" aria-label="Order progress">
      {/* Milestone Stepper */}
      <div className="order-stepper no-scrollbar">
        <ol className="order-stepper__list">
          {steps.map((step) => {
            const Icon = step.icon;
            const isPassed = !isTerminated && currentStepIndex > step.id;
            const isCurrent = !isTerminated && currentStepIndex === step.id;

            return (
              <li
                key={step.id}
                className={`order-stepper__item ${
                  isPassed
                    ? "order-stepper__item--completed"
                    : isCurrent
                      ? "order-stepper__item--active"
                      : ""
                }`}
              >
                <div className="order-stepper__node">
                  <Icon size={14} aria-hidden="true" />
                </div>
                <span className="order-stepper__label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Schedule & Deadline Bar */}
      <div className="order-tracker-bar">
        {/* Left: Day progress */}
        <div className="order-tracker-bar__item">
          <div className="order-tracker-bar__meta">
            <span className="order-tracker-bar__title">
              <Clock3 size={14} className="text-primary" aria-hidden="true" />
              {labels.daysRunning
                .replace("{current}", String(isCompleted ? safeTotalDays : elapsedDays))
                .replace("{total}", String(safeTotalDays))}
            </span>
            <span className="order-tracker-bar__sub">
              {progressPct}% {labels.deliveryTime.toLowerCase()}
            </span>
          </div>
          <div className="order-tracker-progress">
            <div
              className={`order-tracker-progress__fill ${
                deadlineStatus === "overdue" ? "order-tracker-progress__fill--danger" : ""
              }`}
              style={{ width: `${isCompleted ? 100 : progressPct}%` }}
            />
          </div>
        </div>

        {/* Center: Deadline Status Badge */}
        <div className="order-tracker-bar__item">
          <span className="order-tracker-bar__kicker">{labels.deadline}</span>
          <div className="order-tracker-bar__deadline-row">
            <Calendar size={14} aria-hidden="true" />
            <span className="order-tracker-bar__deadline-date">
              {formattedDeadline || labels.noDeadline}
            </span>
            {deadlineStatus === "completed" ? (
              <span className="badge badge--success">
                {labels.statusCompleted}
              </span>
            ) : deadlineStatus === "overdue" ? (
              <span className="badge badge--danger">
                <AlertCircle size={12} />
                {labels.statusOverdue.replace("{days}", String(Math.abs(remainingDays)))}
              </span>
            ) : deadlineStatus === "due_today" ? (
              <span className="badge badge--warning">
                {labels.statusDueToday}
              </span>
            ) : (
              <span className="badge badge--success">
                {labels.statusOnTrack.replace("{days}", String(remainingDays))}
              </span>
            )}
          </div>
        </div>

        {/* Right: Revisions summary */}
        <div className="order-tracker-bar__item order-tracker-bar__item--revisions">
          <span className="order-tracker-bar__kicker">
            <RotateCcw size={12} aria-hidden="true" />
            {revisionsText}
          </span>
          <span className="order-tracker-bar__sub">
            {hasRevisions
              ? `${revisionsUsed}x diajukan revisi`
              : "Belum ada revisi diminta"}
          </span>
        </div>
      </div>
    </section>
  );
}
