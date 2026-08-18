// lib/finance-engine.ts — FULL FILE

export type ObligationFrequency = "weekly" | "biweekly" | "monthly" | "semiannual" | "annual" | "one-time";
export type ObligationKind = "auto-insurance" | "credit-card" | "debt" | "auto-loan" | "rent" | "other";
export type TransactionCategory = "grocery" | "dining" | "travel" | "shopping" | "other";
export type DebtStrategy = "avalanche" | "snowball" | "cashflow-safety";
export type Confidence = "REQUIRED" | "OPPORTUNITY" | "ESTIMATE" | "SCENARIO" | "HISTORICAL";

export interface Obligation {
  id: string;
  label: string;
  kind: ObligationKind;
  amount: number;
  dueDate: string;
  frequency: ObligationFrequency;
  apr?: number;
  balance?: number;
  isSubscription?: boolean; // NEW — explicit user flag, never inferred
}

export interface Goal {
  id: string;
  label: string;
  target: number;
  current: number;
  deadline?: string;
}

export interface Paycheck {
  id: string;
  date: string;
  expectedAmount: number;
  actualAmount: number;
}

export interface Transaction {
  id: string;
  label: string;
  category: TransactionCategory;
  amount: number;
  date: string;
  status: "spent" | "planned";
}

export type CategoryBudgets = Partial<Record<TransactionCategory, number>>; // NEW

export interface FinanceState {
  cash: number;
  incomeAmount: number;
  incomeType: "hourly" | "biweekly" | "monthly";
  hoursPerWeek: number;
  cashBuffer?: number;
  debtStrategy?: DebtStrategy;
  obligations: Obligation[];
  goals: Goal[];
  paychecks: Paycheck[];
  transactions: Transaction[];
  categoryBudgets?: CategoryBudgets; // NEW
}

export const KINDS: ObligationKind[] = ["auto-insurance", "credit-card", "debt", "auto-loan", "rent", "other"];
export const DEBT_KINDS: ObligationKind[] = ["credit-card", "debt", "auto-loan"];
export const FREQUENCIES: ObligationFrequency[] = ["weekly", "biweekly", "monthly", "semiannual", "annual", "one-time"];
export const TRANSACTION_CATEGORIES: TransactionCategory[] = ["grocery", "dining", "travel", "shopping", "other"];

export const TIMELINE_HORIZON_DAYS = 60;
export const RUNWAY_HORIZON_DAYS = 180;
export const RUNWAY_TARGETS = [30, 90, 180];
export const PAY_NOW_WINDOW_DAYS = 3;
export const PRIORITY_WINDOW_DAYS = 14;
export const TREND_MONTHS_BACK = 4; // NEW — how many months the trend chart looks at

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function monthlyEquivalent(o: Obligation): number {
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

export function periodsPerMonth(incomeType: "hourly" | "biweekly" | "monthly"): number {
  if (incomeType === "monthly") return 1;
  if (incomeType === "biweekly") return 26 / 12;
  return 52 / 12;
}

export function monthlyIncome(f: FinanceState): number {
  if (f.incomeType === "monthly") return f.incomeAmount || 0;
  if (f.incomeType === "biweekly") return (f.incomeAmount || 0) * (26 / 12);
  return (f.incomeAmount || 0) * (f.hoursPerWeek || 0) * (52 / 12);
}

// ---------------------------------------------------------------------------
// CASH-FLOW TIMELINE — the single source of truth every other calc reads from
// ---------------------------------------------------------------------------

export interface CashFlowEvent {
  date: Date;
  label: string;
  amount: number;
  type: "income" | "obligation" | "transaction";
}

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

export function buildCashFlowEvents(f: FinanceState, horizonDays: number, overrideIncomeAmount?: number): CashFlowEvent[] {
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

  for (const t of f.transactions ?? []) {
    if (t.status !== "planned" || !t.date) continue;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime()) || d < today || d > horizonEnd) continue;
    events.push({ date: d, label: `${t.label} (planned)`, amount: -t.amount, type: "transaction" });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface TimelinePoint extends CashFlowEvent { projectedBalance: number; }

export function projectBalance(startingCash: number, events: CashFlowEvent[]): TimelinePoint[] {
  let running = startingCash;
  return events.map((e) => { running += e.amount; return { ...e, projectedBalance: running }; });
}

export interface SafeToSpendResult {
  safeToSpend: number;
  reserved: number;
  minProjectedBalance: number;
  minProjectedDate: Date | null;
  shortageRisk: boolean;
}

export function calculateSafeToSpend(startingCash: number, timeline: TimelinePoint[], cashBuffer: number): SafeToSpendResult {
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

export function buildRunway(startingCash: number, timeline: TimelinePoint[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return RUNWAY_TARGETS.map((days) => {
    const target = new Date(today); target.setDate(target.getDate() + days);
    return { days, projected: projectedBalanceAtDay(startingCash, timeline, target) };
  });
}

// ---------------------------------------------------------------------------
// DEBT STRATEGY
// ---------------------------------------------------------------------------

export const STRATEGY_LABELS: Record<DebtStrategy, string> = {
  avalanche: "Avalanche (highest APR first)",
  snowball: "Snowball (smallest balance first)",
  "cashflow-safety": "Cash-Flow Safety (biggest monthly payment first)",
};

export const STRATEGY_EXPLANATIONS: Record<DebtStrategy, string> = {
  avalanche: "Minimizes total interest paid. Best if you're motivated by the math and can stay consistent without early wins.",
  snowball: "Clears small balances first for quick wins, usually at a higher total-interest cost than avalanche. Best if momentum matters more than optimal math.",
  "cashflow-safety": "Pays off whatever frees the most monthly cash flow first, improving safe-to-spend fastest. Best when breathing room is the priority right now.",
};

export function sortByStrategy(obligations: Obligation[], strategy: DebtStrategy): Obligation[] {
  const withBalance = obligations.filter((o) => (o.balance ?? 0) > 0);
  switch (strategy) {
    case "avalanche": return [...withBalance].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
    case "snowball": return [...withBalance].sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
    case "cashflow-safety": return [...withBalance].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  }
}

// ---------------------------------------------------------------------------
// PAYMENT PRIORITY QUEUE
// ---------------------------------------------------------------------------

const PRIORITY_TIER: Record<ObligationKind, number> = {
  rent: 1,
  "auto-insurance": 2,
  "auto-loan": 2,
  debt: 3,
  "credit-card": 4,
  other: 5,
};

export const PRIORITY_TIER_LABEL: Record<number, string> = {
  1: "Essential — housing",
  2: "Essential — secured/insured",
  3: "Debt — minimum required",
  4: "Debt — revolving",
  5: "Other",
};

export type PriorityStatus = "FUNDED" | "AT_RISK" | "UNFUNDED";

export interface PriorityItem {
  obligation: Obligation;
  tier: number;
  status: PriorityStatus;
  shortfall: number;
}

export function buildPriorityQueue(obligations: Obligation[], availableCash: number, windowDays: number = PRIORITY_WINDOW_DAYS): PriorityItem[] {
  const due = obligations
    .filter((o) => o.dueDate && daysUntil(o.dueDate) <= windowDays && daysUntil(o.dueDate) >= 0)
    .sort((a, b) => {
      const tierDiff = PRIORITY_TIER[a.kind] - PRIORITY_TIER[b.kind];
      if (tierDiff !== 0) return tierDiff;
      return daysUntil(a.dueDate) - daysUntil(b.dueDate);
    });

  let remaining = availableCash;
  return due.map((o) => {
    const tier = PRIORITY_TIER[o.kind];
    if (remaining >= o.amount) { remaining -= o.amount; return { obligation: o, tier, status: "FUNDED" as const, shortfall: 0 }; }
    if (remaining > 0) { const shortfall = o.amount - remaining; remaining = 0; return { obligation: o, tier, status: "AT_RISK" as const, shortfall }; }
    return { obligation: o, tier, status: "UNFUNDED" as const, shortfall: o.amount };
  });
}

// ---------------------------------------------------------------------------
// SPENDING BY CATEGORY (30-day rolling)
// ---------------------------------------------------------------------------

export interface CategorySpend { category: string; amount: number; }

export function buildCategorySpend(f: FinanceState): CategorySpend[] {
  const byCategory = new Map<string, number>();
  for (const o of f.obligations) {
    const key = o.kind.replace("-", " ");
    byCategory.set(key, (byCategory.get(key) ?? 0) + monthlyEquivalent(o));
  }
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  for (const t of f.transactions ?? []) {
    if (t.status !== "spent") continue;
    if (new Date(t.date) < thirtyDaysAgo) continue;
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// NEW — CATEGORY BUDGETS (discretionary only, never touches obligations)
// ---------------------------------------------------------------------------

export interface BudgetStatus {
  category: TransactionCategory;
  spent: number;
  cap: number;
  pct: number;
  overCap: boolean;
}

export function buildBudgetStatus(f: FinanceState): BudgetStatus[] {
  const budgets = f.categoryBudgets ?? {};
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const spentByCategory = new Map<TransactionCategory, number>();
  for (const t of f.transactions ?? []) {
    if (t.status !== "spent" || new Date(t.date) < thirtyDaysAgo) continue;
    spentByCategory.set(t.category, (spentByCategory.get(t.category) ?? 0) + t.amount);
  }
  return TRANSACTION_CATEGORIES
    .filter((c) => budgets[c] !== undefined && budgets[c]! > 0)
    .map((category) => {
      const spent = spentByCategory.get(category) ?? 0;
      const cap = budgets[category]!;
      const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
      return { category, spent, cap, pct, overCap: spent > cap };
    });
}

// ---------------------------------------------------------------------------
// NEW — MONTH-OVER-MONTH SPEND TREND (only real data, no fabricated points)
// ---------------------------------------------------------------------------

export interface MonthlySpendPoint { monthLabel: string; total: number; }

export function buildSpendTrend(f: FinanceState, monthsBack: number = TREND_MONTHS_BACK): { data: MonthlySpendPoint[]; sufficientData: boolean } {
  const spent = (f.transactions ?? []).filter((t) => t.status === "spent");
  const buckets = new Map<string, number>(); // "YYYY-MM" -> total
  for (const t of spent) {
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
  }

  const today = new Date();
  const data: MonthlySpendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    data.push({ monthLabel: d.toLocaleDateString("en-US", { month: "short" }), total: buckets.get(key) ?? 0 });
  }

  const distinctMonthsWithData = data.filter((p) => p.total > 0).length;
  return { data, sufficientData: distinctMonthsWithData >= 2 };
}

// ---------------------------------------------------------------------------
// NEW — SUBSCRIPTIONS (explicit user flag only, never inferred from data)
// ---------------------------------------------------------------------------

export function buildSubscriptions(obligations: Obligation[]) {
  const subs = obligations.filter((o) => o.isSubscription);
  const monthlyTotal = subs.reduce((s, o) => s + monthlyEquivalent(o), 0);
  return { subs, monthlyTotal };
}
