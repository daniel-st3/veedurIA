"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

type Props = {
  message: string;
  onRetry: () => void;
  fallbackNote?: string;
};

export function NetworkError({ message, onRetry, fallbackNote }: Props) {
  return (
    <div className="sed-canvas-error">
      <AlertCircle size={28} strokeWidth={1.5} className="sed-canvas-error__icon" />
      <p className="sed-canvas-error__message">{message}</p>
      <button onClick={onRetry} className="sed-canvas-error__retry">
        <RefreshCw size={14} />
        {/* Bilingual prompt; the surrounding error message already carries locale */}
        Reintentar / Retry
      </button>
      {fallbackNote && (
        <p className="sed-canvas-error__fallback">{fallbackNote}</p>
      )}
    </div>
  );
}
