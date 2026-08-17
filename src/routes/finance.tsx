// routes/finance.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2, Plus, TrendingUp, ShieldAlert, Pencil, Check, X, Target, Sparkles, AlertOctagon } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import {
  useGhost, uid, money, monthlyIncome, daysUntil,
  type Obligation, type ObligationFrequency, type Goal, type Paycheck,
} from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KINDS: Obligation["kind"][] = ["auto-insurance", "credit-card", "debt", "auto-loan", "rent", "other"];
const DEBT_KINDS: Obligation["kind"][] = ["credit-card", "debt", "auto-loan"];
const FREQUENCIES: ObligationFrequency[] = ["weekly", "biweekly", "monthly", "semiannual", "annual", "one-time"];
const TIMELINE_HORIZON_DAYS = 60;
const RUNWAY_HORIZON_DAYS = 180;
const RUNWAY_TARGETS = [30, 90, 180];
const PAY_NOW_WINDOW_DAYS = 3;

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance Engine — Ghost OS" },
      { name: "description", content: "Deterministic cash-flow planning: safe-to-spend, debt strategy, goals, and what to pay today." },
      { property: "og:title", content: "Finance Engine — Ghost OS" },
      { property: "og:description", content: "Know what's coming, not just what's owed." },
    ],
  }),
  component: () => (
    <Gate>
      <FinancePage />
    </Gate>
  ),
});

// ---------------------------------------------------------------------------
// DETERMINISTIC HELPERS — pure functions, no AI, unit-testable in isolation.
// ---------------------------------------------------------------------------

function monthlyEquivalent(o: Obligation): number {
  switch (o.frequency ?? "monthly") {
    case "weekly": return (o.amount * 52) / 12;
    case "biweekly": return (o.amount * 26) / 12;
    case "monthly": return o.amount;
    case "semiannual": return o.amount / 6;
    case "annual": return o.amount / 12;
    case "one-time": return 0;
    default: return o.amount;
  }
}

function periodsPerMonth(incomeType: "hourly" | "biweekly" | "monthly"): number {
  if (incomeType === "monthly") return 1;
  if (incomeType === "biweekly") return 26 / 12;
  return 52 / 12; // hourly treated as weekly cadence, matches timeline assumption below
}

interface CashFlowEvent { date: Date; label: string; amount: number; type: "income" | "obligation"; }

function advance(date: Date, frequency: ObligationFrequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); return d;
    case "biweekly": d.setDate(d.getDate() + 14); return d;
    case "monthly": d.setMonth(d.getMonth() + 1); return d;
    case "semiannual": d.setMonth(d.getMonth() + 6); return d;
    case "annual": d.setFullYear(d.getFullYear() + 1); return d;
    case "one-time": return new Date(8640000000000000);
  }
}

function buildCashFlowEvents(
  f: { incomeAmount: number; incomeType: "hourly" | "biweekly" | "monthly"; hoursPerWeek: number; obligations: Obligation[] },
  horizonDays: number,
  overrideIncomeAmount?: number,
): CashFlowEvent[] {
  const events: CashFlowEvent[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today); horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const incomeAmount = overrideIncomeAmount ?? f.incomeAmount;
  if (incomeAmount > 0) {
    if (f.incomeType === "biweekly") {
      let d = new Date(today);
      while (d <= horizonEnd) { events.push({ date: new Date(d), label: "Paycheck", amount: incomeAmount, type: "income" }); d.setDate(d.getDate() + 14); }
    } else if (f.incomeType === "monthly") {
      let d = new Date(today);
      while (d <= horizonEnd) { events.push({ date: new Date(d), label: "Paycheck", amount: incomeAmount, type: "income" }); d.setMonth(d.getMonth() + 1); }
    } else {
      const weeklyAmount = incomeAmount * f.hoursPerWeek;
      let d = new Date(today);
      while (d <= horizonEnd) { events.push({ date: new Date(d), label: "Paycheck (hourly)", amount: weeklyAmount, type: "income" }); d.setDate(d.getDate() + 7); }
    }
  }

  for (const o of f.obligations) {
    if (!o.dueDate) continue;
    const frequency = o.frequency ?? "monthly";
    let d = new Date(o.dueDate);
    if (Number.isNaN(d.getTime())) continue;
    let guard = 0;
    while (d < today && guard < 1000) { d = advance(d, frequency); guard++; }
    while (d <= horizonEnd) {
      events.push({ date: new Date(d), label: o.label, amount: -o.amount, type: "obligation" });
      if (frequency === "one-time") break;
      d = advance(d, frequency);
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface TimelinePoint extends CashFlowEvent { projectedBalance: number; }

function projectBalance(startingCash: number, events: CashFlowEvent[]): TimelinePoint[] {
  let running = startingCash;
  return events.map((e) => { running += e.amount; return { ...e, projectedBalance: running }; });
}

interface SafeToSpendResult {
  safeToSpend: number; reserved: number; minProjectedBalance: number; minProjectedDate: Date | null; shortageRisk: boolean;
}

function calculateSafeToSpend(startingCash: number, timeline: TimelinePoint[], cashBuffer: number): SafeToSpendResult {
  if (timeline.length === 0) {
    return { safeToSpend: Math.max(0, startingCash - cashBuffer), reserved: 0, minProjectedBalance: startingCash, minProjectedDate: null, shortageRisk: startingCash < cashBuffer };
  }
  let min = startingCash; let minDate: Date | null = null;
  for (const point of timeline) { if (point.projectedBalance < min) { min = point.projectedBalance; minDate = point.date; } }
  const safeToSpend = Math.max(0, min - cashBuffer);
  const reserved = Math.max(0, startingCash - safeToSpend - cashBuffer);
  return { safeToSpend, reserved, minProjectedBalance: min, minProjectedDate: minDate, shortageRisk: min < cashBuffer };
}

function projectedBalanceAtDay(startingCash: number, timeline: TimelinePoint[], targetDate: Date): number {
  let balance = startingCash;
  for (const point of timeline) { if (point.date <= targetDate) balance = point.projectedBalance; else break; }
  return balance;
}

function buildRunway(startingCash: number, timeline: TimelinePoint[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return RUNWAY_TARGETS.map((days) => {
    const target = new Date(today); target.setDate(target.getDate() + days);
    return { days, projected: projectedBalanceAtDay(startingCash, timeline, target) };
  });
}

type DebtStrategy = "avalanche" | "snowball" | "cashflow-safety";

const STRATEGY_LABELS: Record<DebtStrategy, string> = {
  avalanche: "Avalanche (highest APR first)",
  snowball: "Snowball (smallest balance first)",
  "cashflow-safety": "Cash-Flow Safety (biggest monthly payment first)",
};
const STRATEGY_EXPLANATIONS: Record<DebtStrategy, string> = {
  avalanche: "Minimizes total interest paid. Best if you're motivated by the math and can stay consistent without early wins.",
  snowball: "Clears small balances first for quick wins, usually at a higher total-interest cost than avalanche. Best if momentum matters more than optimal math.",
  "cashflow-safety": "Pays off whatever frees the most monthly cash flow first, improving safe-to-spend fastest. Best when breathing room is the priority right now.",
};

function sortByStrategy(obligations: Obligation[], strategy: DebtStrategy): Obligation[] {
  const withBalance = obligations.filter((o) => (o.balance ?? 0) > 0);
  switch (strategy) {
    case "avalanche": return [...withBalance].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
    case "snowball": return [...withBalance].sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
    case "cashflow-safety": return [...withBalance].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  }
}

type Confidence = "REQUIRED" | "OPPORTUNITY" | "ESTIMATE" | "SCENARIO" | "HISTORICAL";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  REQUIRED: "bg-destructive/15 text-destructive",
  OPPORTUNITY: "bg-emerald-500/15 text-emerald-500",
  ESTIMATE: "bg-amber-500/15 text-amber-500",
  SCENARIO: "bg-blue-500/15 text-blue-500",
  HISTORICAL: "bg-muted text-muted-foreground",
};

function ConfidenceTag({ type }: { type: Confidence }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_STYLES[type]}`}>{type}</span>;
}

// "What should I pay?" — classifies obligations against the SAME timeline
// math used everywhere else, so it can't disagree with Safe to Spend.
interface PayAction { obligation: Obligation; action: "PAY NOW" | "RESERVE"; why: string; }

function buildPayPlan(obligations: Obligation[], cash: number): PayAction[] {
  return obligations
    .filter((o) => o.dueDate)
    .map((o) => {
      const days = daysUntil(o.dueDate);
      if (days <= PAY_NOW_WINDOW_DAYS && cash >= o.amount) {
        return { obligation: o, action: "PAY NOW" as const, why: `Due in ${days} day${days === 1 ? "" : "s"} and cash on hand covers it.` };
      }
      return { obligation: o, action: "RESERVE" as const, why: `Due in ${days} days — already counted in your reserved total, not yet due.` };
    })
    .sort((a, b) => daysUntil(a.obligation.dueDate) - daysUntil(b.obligation.dueDate));
}

const emptyEditForm: Partial<Obligation> = {};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

function FinancePage() {
  const { state, update } = useGhost();
  const f = state.finance;
  const setF = (patch: Partial<typeof f>) => update((s) => ({ finance: { ...s.finance, ...patch } }));

  const income = monthlyIncome(f);
  const owedMonthly = f.obligations.reduce((s, o) => s + monthlyEquivalent(o), 0);
  const debtMonthly = f.obligations.filter((o) => DEBT_KINDS.includes(o.kind)).reduce((s, o) => s + monthlyEquivalent(o), 0);
  const needsRatio = income > 0 ? Math.min(100, (owedMonthly / income) * 100) : 0;
  const cashBuffer = f.cashBuffer ?? 200;
  const debtStrategy: DebtStrategy = f.debtStrategy ?? "avalanche";
  const goals: Goal[] = f.goals ?? [];
  const paychecks: Paycheck[] = f.paychecks ?? [];

  const [scenarioActive, setScenarioActive] = useState(false);
  const [scenarioIncome, setScenarioIncome] = useState(String(f.incomeAmount || ""));

  const liveTimeline = useMemo(() => projectBalance(f.cash, buildCashFlowEvents(f, TIMELINE_HORIZON_DAYS)), [f]);
  const runwayTimeline = useMemo(() => projectBalance(f.cash, buildCashFlowEvents(f, RUNWAY_HORIZON_DAYS)), [f]);
  const liveSafeToSpend = useMemo(() => calculateSafeToSpend(f.cash, liveTimeline, cashBuffer), [f.cash, liveTimeline, cashBuffer]);
  const runway = useMemo(() => buildRunway(f.cash, runwayTimeline), [f.cash, runwayTimeline]);

  const scenarioTimeline = useMemo(() => {
    if (!scenarioActive) return null;
    return projectBalance(f.cash, buildCashFlowEvents(f, TIMELINE_HORIZON_DAYS, Number(scenarioIncome) || 0));
  }, [f, scenarioActive, scenarioIncome]);
  const scenarioSafeToSpend = useMemo(
    () => (scenarioTimeline ? calculateSafeToSpend(f.cash, scenarioTimeline, cashBuffer) : null),
    [scenarioTimeline, f.cash, cashBuffer],
  );
  const displayedSTS = scenarioActive ? scenarioSafeToSpend! : liveSafeToSpend;

  // Emergency = TODAY's cash is already under buffer. Distinct from
  // shortageRisk, which is a FUTURE projection — conflating them would bury
  // an urgent problem inside a routine cautionary banner.
  const inEmergency = f.cash < cashBuffer;

  const payPlan = useMemo(() => buildPayPlan(f.obligations, f.cash), [f.obligations, f.cash]);
  const payNowItems = payPlan.filter((p) => p.action === "PAY NOW");

  // --- Money Opportunities (found money + slack + goal timing) ---
  const recentPaychecks = [...paychecks].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const lastPaycheck = recentPaychecks[0];
  const foundMoney = lastPaycheck && lastPaycheck.actualAmount > lastPaycheck.expectedAmount
    ? lastPaycheck.actualAmount - lastPaycheck.expectedAmount
    : 0;
  const paycheckRange = recentPaychecks.length >= 2
    ? { min: Math.min(...recentPaychecks.map((p) => p.actualAmount)), max: Math.max(...recentPaychecks.map((p) => p.actualAmount)) }
    : null;
  const spareSlack = Math.max(0, displayedSTS.safeToSpend - cashBuffer * 0.25); // slack beyond a quarter-buffer cushion
  const microSuggestion = spareSlack >= 5 ? Math.min(25, Math.floor(spareSlack / 5) * 5) : 0;
  const earliestGoal = [...goals].filter((g) => g.target > g.current)
    .sort((a, b) => (a.deadline && b.deadline ? (a.deadline < b.deadline ? -1 : 1) : a.deadline ? -1 : b.deadline ? 1 : 0))[0];

  const hasOpportunities = foundMoney > 0 || microSuggestion > 0;
  const nothingNeedsAttention = !inEmergency && !displayedSTS.shortageRisk && payNowItems.length === 0 && !hasOpportunities;

  // --- Financial health score — every component shown, nothing opaque ---
  const bufferScore = Math.round(25 * Math.min(1, f.cash / Math.max(cashBuffer * 2, 1)));
  const debtScore = Math.round(25 * (1 - Math.min(1, income > 0 ? debtMonthly / income : 0)));
  const flowScore = displayedSTS.shortageRisk ? 10 : 25;
  const goalScore = goals.length === 0 ? 25 : Math.round(
    25 * (goals.reduce((s, g) => s + Math.min(1, g.target > 0 ? g.current / g.target : 1), 0) / goals.length),
  );
  const healthScore = bufferScore + debtScore + flowScore + goalScore;
  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Healthy" : healthScore >= 40 ? "Needs Attention" : "At Risk";

  // --- Obligation add/edit form state ---
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Obligation["kind"]>("other");
  const [frequency, setFrequency] = useState<ObligationFrequency>("monthly");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [apr, setApr] = useState("");
  const [balance, setBalance] = useState("");

  function addObligation() {
    if (!label.trim() || !dueDate) return;
    setF({ obligations: [...f.obligations, { id: uid(), label: label.trim(), kind, frequency, amount: Number(amount) || 0, dueDate, apr: Number(apr) || undefined, balance: Number(balance) || undefined }] });
    setLabel(""); setAmount(""); setApr(""); setBalance(""); setDueDate(""); setFrequency("monthly");
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Obligation>>(emptyEditForm);
  function startEdit(o: Obligation) { setEditingId(o.id); setEditForm({ ...o }); }
  function cancelEdit() { setEditingId(null); setEditForm(emptyEditForm); }
  function saveEdit() {
    if (!editingId) return;
    setF({ obligations: f.obligations.map((o) => (o.id === editingId ? { ...o, ...editForm, id: o.id } : o)) });
    cancelEdit();
  }

  const payoffOrder = sortByStrategy(f.obligations, debtStrategy);
  const [extraPayment, setExtraPayment] = useState("0");
  const topPayoff = payoffOrder[0];
  const topPayoffMonths = topPayoff
    ? Math.ceil((topPayoff.balance ?? 0) / Math.max(topPayoff.amount + (Number(extraPayment) || 0), 1))
    : null;

  // --- Goal form state ---
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  function addGoal() {
    if (!goalLabel.trim() || !goalTarget) return;
    setF({ goals: [...goals, { id: uid(), label: goalLabel.trim(), target: Number(goalTarget) || 0, current: Number(goalCurrent) || 0, deadline: goalDeadline || undefined }] });
    setGoalLabel(""); setGoalTarget(""); setGoalCurrent(""); setGoalDeadline("");
  }
  function requiredPerPeriod(g: Goal): { amount: number; behindDeadline: boolean } | null {
    if (!g.deadline) return null;
    const remaining = Math.max(0, g.target - g.current);
    const monthsLeft = (new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
    if (monthsLeft <= 0) return { amount: remaining, behindDeadline: remaining > 0 };
    const perMonth = remaining / monthsLeft;
    return { amount: perMonth / periodsPerMonth(f.incomeType), behindDeadline: false };
  }
  function moveMicroSavings(goalId: string, amt: number) {
    setF({
      cash: f.cash - amt,
      goals: goals.map((g) => (g.id === goalId ? { ...g, current: g.current + amt } : g)),
    });
  }

  // --- Paycheck log form state ---
  const [pcDate, setPcDate] = useState("");
  const [pcExpected, setPcExpected] = useState("");
  const [pcActual, setPcActual] = useState("");
  function logPaycheck() {
    if (!pcDate || !pcActual) return;
    setF({ paychecks: [...paychecks, { id: uid(), date: pcDate, expectedAmount: Number(pcExpected) || Number(pcActual) || 0, actualAmount: Number(pcActual) || 0 }] });
    setPcDate(""); setPcExpected(""); setPcActual("");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Finance Engine</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Cash on hand" value={money(f.cash)} />
        <Stat label="Reserved (upcoming bills)" value={money(displayedSTS.reserved)} />
        <Stat label="Safe to spend" value={money(displayedSTS.safeToSpend)} danger={displayedSTS.shortageRisk} />
        <Stat label="Monthly obligations" value={money(owedMonthly)} />
      </div>

      {inEmergency && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive bg-destructive/10 px-4 py-3">
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Financial Emergency — cash is already below your buffer today</p>
            <p className="text-xs text-muted-foreground">
              Cash: {money(f.cash)} · Buffer: {money(cashBuffer)} · Shortfall: {money(cashBuffer - f.cash)}. Priority order: essential
              obligations, minimum debt payments, cash preservation — discretionary spending last.
            </p>
          </div>
        </div>
      )}

      {!inEmergency && displayedSTS.shortageRisk && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Projected cash-flow shortage <ConfidenceTag type="REQUIRED" /></p>
            <p className="text-xs text-muted-foreground">
              Projected to dip below your {money(cashBuffer)} buffer
              {displayedSTS.minProjectedDate ? ` around ${displayedSTS.minProjectedDate.toLocaleDateString()}` : ""}, low of {money(displayedSTS.minProjectedBalance)}.
            </p>
          </div>
        </div>
      )}

      {nothingNeedsAttention && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          You're on track. Nothing needs your attention right now.
        </div>
      )}

      <Tile title="Income & buffer">
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-1.5"><Label className="text-xs uppercase">Amount</Label><Input value={f.incomeAmount || ""} onChange={(e) => setF({ incomeAmount: Number(e.target.value) || 0 })} inputMode="decimal" /></div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Type</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={f.incomeType} onChange={(e) => setF({ incomeType: e.target.value as typeof f.incomeType })}>
              <option value="hourly">Hourly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs uppercase">Hours / week</Label><Input value={f.hoursPerWeek || ""} onChange={(e) => setF({ hoursPerWeek: Number(e.target.value) || 0 })} inputMode="numeric" /></div>
          <div className="space-y-1.5"><Label className="text-xs uppercase">Cash on hand</Label><Input value={f.cash || ""} onChange={(e) => setF({ cash: Number(e.target.value) || 0 })} inputMode="decimal" /></div>
          <div className="space-y-1.5"><Label className="text-xs uppercase">Min buffer</Label><Input value={cashBuffer} onChange={(e) => setF({ cashBuffer: Number(e.target.value) || 0 })} inputMode="decimal" /></div>
        </div>
        {income > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Needs (fixed obligations) vs. income</span>
              <span className={needsRatio > 50 ? "font-semibold text-destructive" : "font-semibold"}>{needsRatio.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${needsRatio > 50 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${needsRatio}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Educational guideline (50/30/20 rule) — not a rule the app enforces.</p>
          </div>
        )}
      </Tile>

      <Tile title="Paycheck log">
        <div className="mb-3 grid gap-2 sm:grid-cols-4">
          <Input type="date" value={pcDate} onChange={(e) => setPcDate(e.target.value)} />
          <Input value={pcExpected} onChange={(e) => setPcExpected(e.target.value)} placeholder="Expected $" />
          <Input value={pcActual} onChange={(e) => setPcActual(e.target.value)} placeholder="Actual $" />
          <Button onClick={logPaycheck}><Plus className="mr-1 size-4" />Log paycheck</Button>
        </div>
        {recentPaychecks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paychecks logged yet — log a few to unlock variability range and found-money detection.</p>
        ) : (
          <div className="space-y-1.5">
            {recentPaychecks.map((p) => (
              <div key={p.id} className="flex justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString()}</span>
                <span>expected {money(p.expectedAmount)}</span>
                <span className="font-semibold">actual {money(p.actualAmount)}</span>
              </div>
            ))}
            {paycheckRange && (
              <p className="pt-1 text-xs text-muted-foreground">
                Recent paychecks ranged {money(paycheckRange.min)}–{money(paycheckRange.max)} <ConfidenceTag type="ESTIMATE" /> — not a guarantee for next paycheck.
              </p>
            )}
          </div>
        )}
      </Tile>

      {hasOpportunities && (
        <Tile title="Money opportunities">
          <div className="space-y-2">
            {foundMoney > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
                <Sparkles className="size-4 text-emerald-500" />
                <span>Your last paycheck was {money(foundMoney)} higher than expected. <ConfidenceTag type="OPPORTUNITY" /></span>
              </div>
            )}
            {microSuggestion > 0 && earliestGoal && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
                <span>You have about {money(spareSlack)} of extra flexibility beyond your buffer. <ConfidenceTag type="OPPORTUNITY" /></span>
                <Button size="sm" variant="outline" onClick={() => moveMicroSavings(earliestGoal.id, microSuggestion)}>
                  Move {money(microSuggestion)} → {earliestGoal.label}
                </Button>
              </div>
            )}
          </div>
        </Tile>
      )}

      {payNowItems.length > 0 && (
        <Tile title="What should I pay today?">
          <div className="space-y-2">
            {payNowItems.map((p) => (
              <div key={p.obligation.id} className="rounded-2xl bg-secondary px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.obligation.label} — {money(p.obligation.amount)}</p>
                  <ConfidenceTag type="REQUIRED" />
                </div>
                <p className="text-xs text-muted-foreground">Why: {p.why}</p>
              </div>
            ))}
          </div>
        </Tile>
      )}

      <Tile title="Runway projection">
        <div className="grid gap-3 sm:grid-cols-3">
          {runway.map((r) => (
            <div key={r.days} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">In {r.days} days</p>
              <p className={`font-display text-xl font-bold ${r.projected < cashBuffer ? "text-destructive" : ""}`}>{money(r.projected)}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Sampled from the same event-by-event calculation as Safe to Spend — not a separate estimate.</p>
      </Tile>

      <Tile title="Add a bill, card or loan">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as Obligation["kind"])}>
            {KINDS.map((k) => <option key={k} value={k}>{k.replace("-", " ")}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={frequency} onChange={(e) => setFrequency(e.target.value as ObligationFrequency)}>
            {FREQUENCIES.map((freq) => <option key={freq} value={freq}>{freq}</option>)}
          </select>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount $" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance $" />
          <div className="flex gap-2">
            <Input value={apr} onChange={(e) => setApr(e.target.value)} placeholder="APR %" />
            <Button onClick={addObligation} size="icon"><Plus className="size-4" /></Button>
          </div>
        </div>
      </Tile>

      <Tile title={`Obligations (${f.obligations.length})`}>
        <div className="space-y-2">
          {f.obligations.length === 0 && <p className="text-sm text-muted-foreground">Nothing tracked yet.</p>}
          {[...f.obligations].sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate)).map((o) =>
            editingId === o.id ? (
              <div key={o.id} className="rounded-2xl bg-secondary px-3 py-2">
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Input value={editForm.label ?? ""} onChange={(e) => setEditForm((s) => ({ ...s, label: e.target.value }))} placeholder="Label" />
                  <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={editForm.frequency ?? "monthly"} onChange={(e) => setEditForm((s) => ({ ...s, frequency: e.target.value as ObligationFrequency }))}>
                    {FREQUENCIES.map((freq) => <option key={freq} value={freq}>{freq}</option>)}
                  </select>
                  <Input value={editForm.amount ?? ""} onChange={(e) => setEditForm((s) => ({ ...s, amount: Number(e.target.value) || 0 }))} placeholder="Amount $" />
                  <Input type="date" value={editForm.dueDate ?? ""} onChange={(e) => setEditForm((s) => ({ ...s, dueDate: e.target.value }))} />
                  <Input value={editForm.balance ?? ""} onChange={(e) => setEditForm((s) => ({ ...s, balance: Number(e.target.value) || undefined }))} placeholder="Balance $" />
                  <Input value={editForm.apr ?? ""} onChange={(e) => setEditForm((s) => ({ ...s, apr: Number(e.target.value) || undefined }))} placeholder="APR %" />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="icon" variant="outline" onClick={cancelEdit} aria-label="Cancel edit"><X className="size-4" /></Button>
                  <Button size="icon" onClick={saveEdit} aria-label="Save edit"><Check className="size-4" /></Button>
                </div>
              </div>
            ) : (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.kind.replace("-", " ")} · {money(o.amount)} {o.frequency ?? "monthly"} · next due {o.dueDate || "—"} · {money(monthlyEquivalent(o))}/mo equiv.
                    {o.balance ? ` · balance ${money(o.balance)}` : ""}{o.apr ? ` · ${o.apr}% APR` : ""}
                  </p>
                </div>
                <button aria-label="Edit obligation" onClick={() => startEdit(o)}><Pencil className="size-4 opacity-60" /></button>
                <button aria-label="Delete obligation" onClick={() => setF({ obligations: f.obligations.filter((x) => x.id !== o.id) })}><Trash2 className="size-4 opacity-60" /></button>
              </div>
            ),
          )}
        </div>
      </Tile>

      <Tile title="Cash-flow timeline (next 60 days)">
        {liveTimeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add income and at least one obligation to see a timeline.</p>
        ) : (
          <ol className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {liveTimeline.map((point, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{point.date.toLocaleDateString()}</span>
                <span className="flex-1 px-3">{point.label}</span>
                <span className={point.amount >= 0 ? "text-emerald-500" : "text-destructive"}>{point.amount >= 0 ? "+" : ""}{money(point.amount)}</span>
                <span className="w-24 text-right font-semibold">{money(point.projectedBalance)}</span>
              </li>
            ))}
          </ol>
        )}
      </Tile>

      <Tile title="Debt payoff strategy">
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(STRATEGY_LABELS) as DebtStrategy[]).map((s) => (
            <button key={s} onClick={() => setF({ debtStrategy: s })} className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${debtStrategy === s ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}>
              <p className="font-semibold">{STRATEGY_LABELS[s]}</p>
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{STRATEGY_EXPLANATIONS[debtStrategy]}</p>

        {payoffOrder.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add balances and APRs to get a payoff plan.</p>
        ) : (
          <>
            <div className="mb-3 flex items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase">Extra payment toward #1 ({topPayoff?.label})</Label>
                <Input value={extraPayment} onChange={(e) => setExtraPayment(e.target.value)} inputMode="decimal" />
              </div>
              {topPayoffMonths !== null && (
                <p className="pb-2 text-xs text-muted-foreground">→ ~{topPayoffMonths} payments to clear at this rate</p>
              )}
            </div>
            <ol className="space-y-2">
              {payoffOrder.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-accent px-3 py-2 text-accent-foreground">
                  <span className="font-display text-lg font-bold">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{o.label}</p>
                    <p className="text-xs opacity-80">
                      {money(o.balance ?? 0)} at {o.apr ?? 0}% · {o.amount ? `~${Math.ceil((o.balance ?? 0) / Math.max(o.amount + (i === 0 ? Number(extraPayment) || 0 : 0), 1))} payments` : "increase payment to clear faster"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Tile>

      <Tile title="Savings goals">
        <div className="mb-3 grid gap-2 sm:grid-cols-4">
          <Input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} placeholder="Goal name" />
          <Input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Target $" />
          <Input value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} placeholder="Current $" />
          <div className="flex gap-2">
            <Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
            <Button onClick={addGoal} size="icon"><Target className="size-4" /></Button>
          </div>
        </div>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet — tuition, emergency fund, a trip, anything with a target amount.</p>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
              const req = requiredPerPeriod(g);
              return (
                <div key={g.id} className="rounded-2xl bg-secondary px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{g.label}</p>
                    <button aria-label="Delete goal" onClick={() => setF({ goals: goals.filter((x) => x.id !== g.id) })}><Trash2 className="size-4 opacity-60" /></button>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {money(g.current)} / {money(g.target)} ({pct.toFixed(0)}%)
                    {g.deadline && ` · target ${new Date(g.deadline).toLocaleDateString()}`}
                    {req && !req.behindDeadline && ` · needs ~${money(req.amount)} per paycheck to hit that date`}
                    {req && req.behindDeadline && ` · deadline passed with ${money(g.target - g.current)} remaining`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Tile>

      <Tile title="What if my paycheck changed?">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Hypothetical income amount</Label>
            <Input value={scenarioIncome} onChange={(e) => setScenarioIncome(e.target.value)} inputMode="decimal" />
          </div>
          <Button variant={scenarioActive ? "default" : "outline"} onClick={() => setScenarioActive((v) => !v)}>
            <TrendingUp className="mr-2 size-4" />{scenarioActive ? "Viewing scenario — click to exit" : "Run scenario"}
          </Button>
          {scenarioActive && <ConfidenceTag type="SCENARIO" />}
        </div>
        {scenarioActive && scenarioSafeToSpend && (
          <p className="text-sm text-muted-foreground">
            At {money(Number(scenarioIncome) || 0)} per paycheck, safe-to-spend becomes{" "}
            <span className="font-semibold text-foreground">{money(scenarioSafeToSpend.safeToSpend)}</span> (currently {money(liveSafeToSpend.safeToSpend)}) — a difference of{" "}
            <span className={scenarioSafeToSpend.safeToSpend >= liveSafeToSpend.safeToSpend ? "text-emerald-500" : "text-destructive"}>{money(scenarioSafeToSpend.safeToSpend - liveSafeToSpend.safeToSpend)}</span>.
            Nothing here is saved until you update your actual income above.
          </p>
        )}
      </Tile>

      <Tile title="Financial health">
        <div className="mb-3 flex items-center gap-4">
          <div className="font-display text-4xl font-bold">{healthScore}</div>
          <div>
            <p className="text-sm font-semibold">{healthLabel}</p>
            <p className="text-xs text-muted-foreground">Every point below is shown — nothing here is a hidden weight.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4 text-xs">
          <ScoreRow label="Cash buffer" score={bufferScore} />
          <ScoreRow label="Debt burden" score={debtScore} />
          <ScoreRow label="Cash-flow stability" score={flowScore} />
          <ScoreRow label="Goal progress" score={goalScore} />
        </div>
      </Tile>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{score} / 25</p>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-3xl border border-border bg-card px-4 py-3 shadow-tile">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
