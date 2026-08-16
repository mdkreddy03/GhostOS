import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CloudSun, Plus, Wallet, ArrowRight } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { GhostChat } from "@/components/ghost/ghost-ai";
import { fetchWeather } from "@/lib/weather";
import {
  useGhost,
  buildPriorities,
  bucket,
  money,
  monthlyIncome,
  todayISO,
  uid,
  type PriorityItem,
} from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GhostOS" },
      {
        name: "description",
        content:
          "GhostOS is a local-first workspace dashboard designed to organize tools, track metrics, and manage automated workflows through a clean, customizable interface.",
      },
      { property: "og:title", content: "GhostOS" },
      { property: "og:description", content: "GhostOS is a local-first workspace dashboard designed to organize tools, track metrics, and manage automated workflows through a clean, customizable interface." },
    ],
  }),
  component: () => (
    <Gate>
      <Dashboard />
    </Gate>
  ),
});

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Dashboard() {
  const { state, update } = useGhost();
  const now = useClock();
  const priorities = buildPriorities(state);
  const high = priorities.filter((p) => bucket(p.days) === "high");
  const medium = priorities.filter((p) => bucket(p.days) === "medium");
  const low = priorities.filter((p) => bucket(p.days) === "low");
  const [quick, setQuick] = useState("");

  const weather = useQuery({
    queryKey: ["weather", state.profile.location],
    queryFn: () => fetchWeather(state.profile.location),
    staleTime: 1000 * 60 * 15,
  });

  const income = monthlyIncome(state.finance);
  const owed = state.finance.obligations.reduce((s, o) => s + o.amount, 0);
  const left = income - owed;
  const hour = now?.getHours() ?? 9;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = state.profile.fullName?.split(" ")[0] || state.account?.username;

  function addQuick() {
    if (!quick.trim()) return;
    update((s) => ({
      todos: [...s.todos, { id: uid(), title: quick.trim(), date: todayISO(), done: false }],
    }));
    setQuick("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {greeting}, {firstName} <span className="align-middle">{state.account?.avatar}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now
              ? now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "…"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-3xl font-bold tabular-nums">
              {now ? now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }) : "--:--"}
            </p>
            <p className="text-xs text-muted-foreground">{state.profile.timezone}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-tile">
            <CloudSun className="size-5 text-primary" />
            {weather.data ? (
              <div className="text-sm">
                <p className="font-semibold">
                  {weather.data.temp}°F · {weather.data.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {weather.data.place} · H {weather.data.high}° L {weather.data.low}°
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {weather.isLoading ? "Loading weather…" : "Add your city in Settings"}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tile title="Quick add to today">
        <div className="flex gap-2">
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addQuick()}
            placeholder="Pay the water bill, call mom…"
          />
          <Button onClick={addQuick}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Tile>

      <div className="grid gap-5 lg:grid-cols-3">
        <Lane title="High priority" subtitle="Today or overdue" tone="high" items={high} />
        <Lane title="Medium priority" subtitle="Next 7 days" tone="medium" items={medium} />
        <Lane title="Low priority" subtitle="More than 7 days out" tone="low" items={low} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tile
          title="Finance"
          action={
            <Link to="/finance" className="flex items-center gap-1 text-xs text-primary">
              Open engine <ArrowRight className="size-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Monthly income" value={money(income)} />
            <Stat label="Bills & debt" value={money(owed)} />
            <Stat label="Left over" value={money(left)} accent={left < 0} />
            <Stat label="Cash on hand" value={money(state.finance.cash)} />
          </div>
          <div className="mt-4 space-y-2">
            {state.finance.obligations.slice(0, 4).map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Wallet className="size-3.5 text-muted-foreground" />
                  {o.label || "Untitled bill"}
                </span>
                <span className="text-muted-foreground">
                  {money(o.amount)} · {o.dueDate || "no date"}
                </span>
              </div>
            ))}
            {state.finance.obligations.length === 0 && (
              <p className="text-sm text-muted-foreground">No bills tracked yet.</p>
            )}
          </div>
        </Tile>

        <Tile title="Ghost AI">
          <GhostChat compact />
        </Tile>
      </div>
    </div>
  );
}

function Lane({
  title,
  subtitle,
  tone,
  items,
}: {
  title: string;
  subtitle: string;
  tone: "high" | "medium" | "low";
  items: PriorityItem[];
}) {
  const toneClass =
    tone === "high"
      ? "bg-high text-high-foreground"
      : tone === "medium"
        ? "bg-medium text-medium-foreground"
        : "bg-low text-low-foreground";
  return (
    <Tile title={title} action={<span className="text-xs text-muted-foreground">{subtitle}</span>}>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here. Breathe.</p>}
        {items.map((p) => (
          <div key={p.id + p.source} className={`rounded-2xl px-3 py-2 ${toneClass}`}>
            <p className="text-sm font-semibold">{p.title}</p>
            <p className="text-xs opacity-80">
              {p.detail} · {p.date || "no date"} ·{" "}
              {p.days === 0 ? "today" : p.days < 0 ? `${Math.abs(p.days)}d overdue` : `in ${p.days}d`}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-bold ${accent ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
