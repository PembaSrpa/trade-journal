"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // styles the confirm button with the danger tokens
  alertOnly?: boolean; // single button, no Cancel — for informational messages
}

type Pending = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);

  const confirmFn = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = original;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {pending &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
              onClick={() => close(false)}
              aria-hidden="true"
            />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby={pending.description ? "confirm-description" : undefined}
            >
              <div className="bg-surface border border-border rounded-2xl p-5 w-full max-w-sm shadow-xl animate-fade-in">
                <p id="confirm-title" className="text-[15px] font-medium mb-1.5">
                  {pending.title}
                </p>
                {pending.description && (
                  <p id="confirm-description" className="text-sm text-text-secondary mb-5">
                    {pending.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {!pending.alertOnly && (
                    <button
                      type="button"
                      autoFocus
                      onClick={() => close(false)}
                      className="!bg-transparent !border-border flex-1 text-sm"
                    >
                      {pending.cancelLabel ?? "Cancel"}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus={pending.alertOnly}
                    onClick={() => close(true)}
                    className={`flex-1 text-sm ${
                      pending.danger
                        ? "!bg-danger/15 !border-danger/30 !text-danger hover:!bg-danger/25"
                        : "bg-accent border-accent hover:bg-accent-glow text-white"
                    }`}
                  >
                    {pending.confirmLabel ?? "OK"}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
