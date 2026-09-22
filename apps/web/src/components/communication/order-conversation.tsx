"use client";

import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare } from "lucide-react";
import type { ConversationThread, Message } from "@/lib/communication-types";
import {
  getOrderThread,
  listThreadMessages,
  sendMessage,
} from "@/lib/communication-client";

type Props = {
  orderID: string;
  currentUserID: string;
  initialThread: ConversationThread | null;
  locale: string;
  labels: {
    title: string;
    placeholder: string;
    send: string;
    sending: string;
    empty: string;
    error: string;
    loadError: string;
  };
};

export function OrderConversation({
  orderID,
  currentUserID,
  initialThread,
  locale,
  labels,
}: Props) {
  const [thread, setThread] = useState<ConversationThread | null>(initialThread);
  const [messages, setMessages] = useState<Message[]>(
    initialThread?.messages ?? [],
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Load thread if not passed initially
  useEffect(() => {
    if (!thread) {
      getOrderThread(orderID)
        .then((t) => {
          setThread(t);
          if (t.messages) setMessages(t.messages);
        })
        .catch(() => {
          setError(labels.loadError);
        });
    }
  }, [orderID, thread, labels.loadError]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Poll for new messages every 8 seconds
  useEffect(() => {
    if (!thread) return;
    let active = true;

    const interval = setInterval(async () => {
      try {
        const lastMsg = messages[messages.length - 1];
        const since = lastMsg?.created_at;
        const newMsgs = await listThreadMessages(thread.id, since, 50);
        if (active && newMsgs.length > 0) {
          setMessages((prev) => {
            const existingIDs = new Set(prev.map((m) => m.id));
            const uniqueNew = newMsgs.filter((m) => !existingIDs.has(m.id));
            return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
          });
        }
      } catch {}
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [thread, messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending || !thread) return;

    setSending(true);
    setError(null);
    try {
      const newMsg = await sendMessage(thread.id, trimmed);
      setMessages((prev) => [...prev, newMsg]);
      setBody("");
    } catch {
      setError(labels.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="order-chat-card" aria-label={labels.title}>
      <div className="order-chat-header">
        <h3 className="order-chat-title">
          <MessageSquare size={18} aria-hidden="true" />
          {labels.title}
        </h3>
      </div>

      <div className="order-chat-messages">
        {messages.length === 0 ? (
          <p className="order-chat-empty">{labels.empty}</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_user_id === currentUserID;
            return (
              <div
                key={m.id}
                className={`order-chat-bubble-row ${
                  isMe ? "order-chat-bubble-row--me" : "order-chat-bubble-row--other"
                }`}
              >
                <div className="order-chat-bubble">
                  {!isMe && m.sender_name && (
                    <span className="order-chat-bubble__sender">
                      {m.sender_name}
                    </span>
                  )}
                  <p className="order-chat-bubble__text">{m.body}</p>
                  <time
                    dateTime={m.created_at}
                    className="order-chat-bubble__time"
                  >
                    {new Date(m.created_at).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <p className="order-chat-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSend} className="order-chat-input-row">
        <input
          type="text"
          className="order-chat-input"
          placeholder={labels.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          disabled={sending || !thread}
        />
        <button
          type="submit"
          className="btn btn-primary order-chat-send-btn"
          disabled={sending || !body.trim() || !thread}
          aria-busy={sending}
        >
          <Send size={16} aria-hidden="true" />
          <span className="sr-only">{sending ? labels.sending : labels.send}</span>
        </button>
      </form>
    </section>
  );
}
