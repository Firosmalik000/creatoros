"use client";

import { useState } from "react";
import { FolderCheck, MessageSquare, FileText } from "lucide-react";

type TabKey = "deliverables" | "discussion" | "brief";

type Props = {
  labels: {
    deliverables: string;
    discussion: string;
    brief: string;
    deliverablesCount?: number;
    messagesCount?: number;
  };
  deliverablesContent: React.ReactNode;
  discussionContent: React.ReactNode;
  briefContent: React.ReactNode;
  defaultTab?: TabKey;
};

export function OrderDetailTabs({
  labels,
  deliverablesContent,
  discussionContent,
  briefContent,
  defaultTab = "deliverables",
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  return (
    <div className="order-tabs-container">
      {/* Tab Navigation */}
      <nav className="order-tabs" aria-label="Order sections" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "deliverables"}
          className={`order-tab-btn ${
            activeTab === "deliverables" ? "order-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab("deliverables")}
        >
          <FolderCheck size={16} aria-hidden="true" />
          <span>{labels.deliverables}</span>
          {typeof labels.deliverablesCount === "number" && labels.deliverablesCount > 0 ? (
            <span className="order-tab-badge">{labels.deliverablesCount}</span>
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "discussion"}
          className={`order-tab-btn ${
            activeTab === "discussion" ? "order-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab("discussion")}
        >
          <MessageSquare size={16} aria-hidden="true" />
          <span>{labels.discussion}</span>
          {typeof labels.messagesCount === "number" && labels.messagesCount > 0 ? (
            <span className="order-tab-badge">{labels.messagesCount}</span>
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "brief"}
          className={`order-tab-btn ${
            activeTab === "brief" ? "order-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab("brief")}
        >
          <FileText size={16} aria-hidden="true" />
          <span>{labels.brief}</span>
        </button>
      </nav>

      {/* Tab Panels */}
      <div className="order-tab-panel" role="tabpanel">
        {activeTab === "deliverables" && (
          <div className="order-tab-panel__content space-y-6">
            {deliverablesContent}
          </div>
        )}
        {activeTab === "discussion" && (
          <div className="order-tab-panel__content">
            {discussionContent}
          </div>
        )}
        {activeTab === "brief" && (
          <div className="order-tab-panel__content space-y-6">
            {briefContent}
          </div>
        )}
      </div>
    </div>
  );
}
