"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { hasPin, verifyPin } from "@/lib/appLock";

const RELOCK_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

/** Shows a PIN screen over the app when an app lock is set. Re-locks after the app has been in the background for a minute. */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const failures = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  const checkLock = useCallback(async () => {
    setLocked(await hasPin());
    setReady(true);
  }, []);

  useEffect(() => {
    void checkLock();
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        hiddenAt.current = null;
        if (await hasPin()) setLocked(true);
      }
    };
    const onSettingsChanged = () => void checkLock().then(() => setLocked(false));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("app-lock-changed", onSettingsChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("app-lock-changed", onSettingsChanged);
    };
  }, [checkLock]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Date.now() < blockedUntil) return;
    if (await verifyPin(pin)) {
      failures.current = 0;
      setPin("");
      setError(null);
      setLocked(false);
      return;
    }
    failures.current += 1;
    setPin("");
    if (failures.current >= MAX_ATTEMPTS) {
      failures.current = 0;
      setBlockedUntil(Date.now() + COOLDOWN_MS);
      setError("Too many attempts. Try again in 30 seconds.");
    } else {
      setError("Wrong PIN");
    }
  }

  if (!ready) return null;
  if (locked) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-xs bg-surface border border-border rounded-2xl p-6 space-y-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center mx-auto">
            <Lock size={18} className="text-accent-glow" />
          </div>
          <p className="font-medium">Journal locked</p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="PIN"
            className="w-full text-center tracking-[0.5em]"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button type="submit" className="w-full bg-accent border-accent text-white font-medium">
            Unlock
          </button>
        </form>
      </div>
    );
  }
  return <>{children}</>;
}
