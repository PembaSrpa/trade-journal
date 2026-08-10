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
import { startSyncListener, flushQueue } from "@/lib/offlineSync";
import { SyncBadge } from "@/components/SyncBadge";

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
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  vertical?: boolean;
  collapsed?: boolean;
}) {
  const showLabel = !vertical || !collapsed;
  return (
    <Link href={href} className="relative block" title={vertical && collapsed ? label : undefined}>
      <div
        className={
          vertical
            ? `flex items-center gap-3 rounded-xl text-sm transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3.5 py-2.5"
              } ${
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
        {showLabel && <span className={vertical ? "font-medium" : ""}>{label}</span>}
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
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email ?? "";
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
  const { triggerSync, refreshAccounts, accountsStatus, accountsCachedAt } = useAccountContext();
  const username = useUsername();
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stop = startSyncListener();
    return stop;
  }, []);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function handleSyncClick() {
    setSyncing(true);
    await flushQueue();
    await refreshAccounts();
    triggerSync();
    setSyncing(false);
  }

  // Client-side auth guard. The Next.js middleware only runs when this app
  // is served by the Next.js server (the website); the Android build loads
  // a locally-bundled copy with no middleware, so this check is what keeps
  // /overview, /journal, /notebook, /settings etc. protected there.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className={`hidden md:flex md:flex-col flex-shrink-0 border-r border-border bg-[#141414] py-6 sticky top-0 h-screen transition-[width] duration-150 ${
          collapsed ? "w-[68px] px-3" : "w-60 px-4"
        }`}
      >
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-2 mb-8 rounded-lg py-1.5 bg-transparent border-none hover:bg-white/5 transition-colors ${
            collapsed ? "justify-center px-0" : "px-2"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center flex-shrink-0">
            <TrendingUp size={17} className="text-accent-glow" />
          </div>
          {!collapsed && <span className="font-medium tracking-tight">Journal</span>}
        </button>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className={`space-y-3 ${collapsed ? "px-0" : "px-2"}`}>
          {!collapsed && <AccountSwitcher />}

          <div
            className={`flex items-center gap-2.5 pt-3 border-t border-border ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <UserAvatar username={username} size={collapsed ? 28 : 32} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                {username ? (
                  <p className="text-sm font-medium truncate">{username}</p>
                ) : (
                  <div className="h-4 w-20 rounded bg-surface-2 animate-pulse mb-1" />
                )}
                <p className="text-xs text-text-muted">Signed in</p>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : "justify-between"}`}>
            <button
              onClick={handleSyncClick}
              disabled={syncing}
              title="Sync now"
              className={`flex items-center gap-1.5 text-xs text-text-secondary bg-transparent border-none px-0 hover:text-text ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {!collapsed && (syncing ? "Syncing..." : "Sync")}
            </button>
            {!collapsed && <SyncBadge status={accountsStatus} cachedAt={accountsCachedAt} />}
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className={`w-full flex items-center gap-2 text-xs text-text-secondary bg-transparent border-none px-0 hover:text-danger ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut size={14} />
            {!collapsed && "Sign out"}
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
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleSyncClick}
                disabled={syncing}
                aria-label="Sync now"
                className="!w-8 !h-8 !p-0 flex items-center justify-center text-text-secondary hover:text-text"
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              </button>
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
          <div className="px-4 pb-3 flex items-center justify-between gap-2">
            <AccountSwitcher className="flex-1 min-w-0" />
            <SyncBadge status={accountsStatus} cachedAt={accountsCachedAt} className="flex-shrink-0 whitespace-nowrap" />
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
