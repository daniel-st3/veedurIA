"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type NoticeTone = "success" | "error" | "info";

export type NoticeItem = {
  id: string;
  tone: NoticeTone;
  title?: string;
  message: string;
};

const ICONS = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
} as const;

export function NoticeStack({
  notices,
  onDismiss,
}: {
  notices: NoticeItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="notice-stack" aria-live="polite" aria-atomic="true">
      {notices.map((notice) => {
        const Icon = ICONS[notice.tone];

        return (
          <article key={notice.id} className={`notice-toast notice-toast--${notice.tone}`}>
            <div className="notice-toast__icon">
              <Icon size={18} />
            </div>
            <div className="notice-toast__copy">
              {notice.title ? <strong>{notice.title}</strong> : null}
              <p>{notice.message}</p>
            </div>
            <button
              type="button"
              className="notice-toast__close"
              onClick={() => onDismiss(notice.id)}
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
