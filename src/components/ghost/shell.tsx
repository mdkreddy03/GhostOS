import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Wallet,
  StickyNote,
  BellRing,
  HeartPulse,
  UtensilsCrossed,
  ShoppingBasket,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { GhostDock } from "./ghost-ai";

const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/food", label: "Food", icon: UtensilsCrossed },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            Ghost<span className="text-primary">OS</span>
          </Link>
          <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary [&.active]:bg-primary [&.active]:text-primary-foreground"
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28">{children}</main>
      <GhostDock />
    </div>
  );
}

export function Tile({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-border bg-card p-5 shadow-tile ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
