"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileSearch,
  Globe,
  Bookmark,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  Sparkles,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Intelligence",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/opportunities", label: "Opportunities", icon: FileSearch },
      { href: "/dashboard/intelligence", label: "AI Analysis", icon: Sparkles },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/sources", label: "Sources", icon: Globe },
      { href: "/dashboard/logs", label: "Crawl Logs", icon: Activity },
      { href: "/dashboard/saved-searches", label: "Saved Searches", icon: Bookmark },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: session } = useSession();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/opportunities?keyword=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar transition-all duration-200 ease-in-out border-r border-sidebar-border",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" />
              <circle cx="11" cy="14" r="3" />
              <path d="m14 17 2 2" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-base font-bold text-white tracking-tight">
              BidToGo
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-widest text-sidebar-muted">
                    {section.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[13px] font-medium transition-colors relative",
                        active
                          ? "bg-sidebar-accent text-white"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-blue-400" />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-sidebar-border px-2 py-2 shrink-0 space-y-1">
          {!collapsed && session?.user?.email && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-xs font-medium text-sidebar-foreground/80 truncate">
                {session.user.name ?? "Admin"}
              </p>
              <p className="text-2xs text-sidebar-muted truncate">
                {session.user.email}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-2xs text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              {!collapsed && <span>Sign out</span>}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors text-xs font-medium">
              BidToGo
            </Link>
            {pathname !== "/dashboard" && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-xs font-medium capitalize">
                  {pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-52 rounded-md border border-input bg-muted/40 pl-8 pr-8 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background transition-colors"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-4 items-center rounded border border-input bg-muted px-1 text-2xs text-muted-foreground font-mono">
                /
              </kbd>
            </div>
          </form>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-5 scrollbar-thin">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
