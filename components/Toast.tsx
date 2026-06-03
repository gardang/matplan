"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "loading";

interface ToastLink {
  label: string;
  href: string;
}

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  link?: ToastLink;
}

export function Toast({ message, type, onDismiss, link }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    if (type === "success") {
      const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 200); }, 4000);
      return () => clearTimeout(t);
    }
    if (type === "error") {
      const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 200); }, 8000);
      return () => clearTimeout(t);
    }
  }, [type, onDismiss]);

  const colors = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    loading: "bg-gray-800 text-white dark:bg-gray-700",
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-xl shadow-lg px-4 py-3 text-sm font-medium max-w-xs w-full transition-all duration-200 ${colors[type]} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      {type === "loading" && (
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </span>
      )}
      <span className="flex-1">{message}</span>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 underline underline-offset-2 whitespace-nowrap font-semibold hover:opacity-80"
        >
          {link.label}
        </a>
      )}
      {type !== "loading" && (
        <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Toast state hook ───────────────────────────────────────────────────────────

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
  link?: ToastLink;
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  function showToast(message: string, type: ToastType = "success", link?: ToastLink) {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type, link }]);
    return id;
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function ToastContainer() {
    return (
      <>
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} link={t.link} onDismiss={() => dismissToast(t.id)} />
        ))}
      </>
    );
  }

  return { showToast, dismissToast, ToastContainer };
}
