"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  NotebookPen,
  Settings,
  RefreshCw,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { AccountProvider, useAccountContext } from "@/lib/AccountContext";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { createClient } from "@/lib/supabase/client";
import { startSyncListener } from "@/lib/offlineSync";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/notebook", label: "Notebook", icon: NotebookPen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  vertical = true,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  vertical?: boolean;
}) {
  return (
    <Link href={href} className="relative block">
      <div
        className={
          vertical
            ? `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "text-white bg-accent-dim"
                  : "text-text-secondary hover:text-text hover:bg-white/5"
              }`
            : `flex flex-col items-center gap-1 py-2 text-[11px] ${
                active ? "text-accent" : "text-text-muted"
              }`
        }
      >
        <Icon size={vertical ? 18 : 20} strokeWidth={2} />
        <span className={vertical ? "font-medium" : ""}>{label}</span>
      </div>
      {active && vertical && (
        <motion.div
          layoutId="nav-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}

function useUsername() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const name = email.split("@")[0];
      setUsername(name || null);
    });
  }, []);

  return username;
}

function UserAvatar({ username, size = 32 }: { username: string | null; size?: number }) {
  const initial = username ? username[0].toUpperCase() : "?";
  return (
    <div
      className="rounded-full bg-accent-dim border border-border-strong flex items-center justify-center text-accent-glow font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { triggerSync } = useAccountContext();
  const username = useUsername();

  useEffect(() => {
    const stop = startSyncListener();
    return stop;
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex md:flex-col w-60 flex-shrink-0 border-r border-border bg-[#141414] px-4 py-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center">
            <TrendingUp size={17} className="text-accent-glow" />
          </div>
          <span className="font-medium tracking-tight">Journal</span>
        </div>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>

        <div className="space-y-3 px-2">
          <AccountSwitcher />

          <div className="flex items-center gap-2.5 pt-3 border-t border-border">
            <UserAvatar username={username} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{username ?? "Loading..."}</p>
              <p className="text-xs text-text-muted">Signed in</p>
            </div>
          </div>

          <button
            onClick={triggerSync}
            className="w-full flex items-center gap-2 text-xs text-text-secondary bg-transparent border-none px-0 hover:text-text"
          >
            <RefreshCw size={14} /> Sync
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 text-xs text-text-secondary bg-transparent border-none px-0 hover:text-danger"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 bg-bg/90 backdrop-blur z-20 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp size={16} className="text-accent-glow flex-shrink-0" />
              <span className="font-medium text-sm truncate">Journal</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <UserAvatar username={username} size={28} />
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="!w-8 !h-8 !p-0 flex items-center justify-center text-text-secondary hover:text-danger"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <div className="px-4 pb-3">
            <AccountSwitcher />
          </div>
        </div>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-[1800px] mx-auto px-5 md:px-8 lg:px-12 py-6 md:py-10 pb-24 md:pb-10"
        >
          {children}
        </motion.main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-[#141414]/95 backdrop-blur grid grid-cols-4 z-20">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.href)}
              vertical={false}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <Shell>{children}</Shell>
    </AccountProvider>
  );
}
