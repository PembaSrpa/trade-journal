"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Starfield } from "@/components/Starfield";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, inviteCode }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Could not create account");
      return;
    }

    router.push("/login");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Starfield />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <p className="text-center text-2xl font-medium mb-1 text-white tracking-tight">
          Create your account
        </p>
        <p className="text-center text-sm text-white/50 mb-8">
          Start your trading journal
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl"
        >
          <div>
            <label className="block text-xs text-white/50 mb-1.5 tracking-wide">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/[0.04] border-white/10"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.04] border-white/10"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 tracking-wide">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/[0.04] border-white/10"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 tracking-wide">
              Invite code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full bg-white/[0.04] border-white/10"
              required
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-danger text-sm"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent border-accent hover:bg-accent-glow text-white font-medium"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-xs text-white/40 text-center pt-1">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-glow">
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
