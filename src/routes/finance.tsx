// routes/finance.tsx — FULL FILE

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Trash2, Plus, TrendingUp, ShieldAlert, Pencil, Check, X,
  Target, Sparkles, AlertOctagon, ListOrdered, ShoppingBag, Repeat,
} from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CashFlowChart, RunwayChart, SpendingByCategoryChart, DebtBalanceChart, SpendTrendChart } from "@/components/finance/charts";
import {
  useGhost, uid,
  money, daysUntil, monthlyIncome, monthlyEquivalent, periodsPerMonth,
  buildCashFlowEvents, projectBalance, calculateSafeToSpend, buildRunway,
  sortByStrategy, buildPriorityQueue, buildCategorySpend, buildBudgetStatus, buildSpendTrend, buildSubscriptions,
  STRATEGY_LABELS, STRATEGY_EXPLANATIONS, PRIORITY_TIER_LABEL,
  KINDS, DEBT_KINDS, FREQUENCIES, TRANSACTION_CATEGORIES,
  TIMELINE_HORIZON_DAYS, RUNWAY_HORIZON_DAYS,
  type Obligation, type ObligationFrequency, type Goal, type Paycheck, type Transaction,
  type DebtStrategy, type Confidence, type CategoryBudgets,
} from "@/lib/finance-engine";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance Engine — Ghost OS" },
      { name: "description", content: "Cash-flow forecasting, payment priority, budgets, debt strategy, goals, and spending in one dashboard." },
    ],
  }),
  component: () => (
    <Gate>
      <FinancePage />
    </Gate>
  ),
});

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

const emptyEditForm: Partial<Obligation> = {};

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
  const transactions: Transaction[] = f.transactions ?? [];
  const categoryBudgets: CategoryBudgets = f.categoryBudgets ?? {};

  const [scenarioActive, setScenarioActive] = useState(false);
  const [scenarioIncome, setScenarioIncome] = useState(String(f.incomeAmount || ""));

  const liveTimeline = useMemo(() => projectBalance(f.cash, buildCashFlowEvents(f, TIMELINE_HORIZON_DAYS)), [f]);
  const runwayTimeline = useMemo(() => projectBalance(f.cash, buildCashFlowEvents(f, RUNWAY_HORIZON_DAYS)), [f]);
  const liveSafeToSpend = useMemo(() => calculateSafeToSpend(f.cash, liveTimeline, cashBuffer), [f.cash, liveTimeline, cashBuffer]);
  const runway = useMemo(() => buildRunway(f.cash, runwayTimeline), [f.cash, runwayTimeline]);
  const categorySpend = useMemo(() => buildCategorySpend(f), [f]);
  const priorityQueue = useMemo(() => buildPriorityQueue(f.obligations, f.cash), [f.obligations, f.cash]);
  const budgetStatus = useMemo(() => buildBudgetStatus(f), [f]);
  const spendTrend = useMemo(() => buildSpendTrend(f), [f]);
  const subscriptions = useMemo(() => buildSubscriptions(f.obligations), [f.obligations]);

  const scenarioTimeline = useMemo(() => {
    if (!scenarioActive) return null;
    return projectBalance(f.cash, buildCashFlowEvents(f, TIMELINE_HORIZON_DAYS, Number(scenarioIncome) || 0));
  }, [f, scenarioActive, scenarioIncome]);
  const scenarioSafeToSpend = useMemo(
    () => (scenarioTimeline ? calculateSafeToSpend(f.cash, scenarioTimeline, cashBuffer) : null),
    [scenarioTimeline, f.cash, cashBuffer],
  );
  const displayedSTS = scenarioActive ? scenarioSafeToSpend! : liveSafeToSpend;
  const displayedTimeline = scenarioActive ? scenarioTimeline! : liveTimeline;

  const inEmergency = f.cash < cashBuffer;
  const hasAtRisk = priorityQueue.some((p) => p.status !== "FUNDED");
  const hasOverBudget = budgetStatus.some((b) => b.overCap);

  const recentPaychecks = [...paychecks].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const lastPaycheck = recentPaychecks[0];
  const foundMoney = lastPaycheck && lastPaycheck.actualAmount > lastPaycheck.expectedAmount ? lastPaycheck.actualAmount - lastPaycheck.expectedAmount : 0;
  const paycheckRange = recentPaychecks.length >= 2 ? { min: Math.min(...recentPaychecks.map((p) => p.actualAmount)), max: Math.max(...recentPaychecks.map((p) => p.actualAmount)) } : null;
  const spareSlack = Math.max(0, displayedSTS.safeToSpend - cashBuffer * 0.25);
  const microSuggestion = spareSlack >= 5 ? Math.min(25, Math.floor(spareSlack / 5) * 5) : 0;
  const earliestGoal = [...goals].filter((g) => g.target > g.current).sort((a, b) => (a.deadline && b.deadline ? (a.deadline < b.deadline ? -1 : 1) : a.deadline ? -1 : b.deadline ? 1 : 0))[0];
  const hasOpportunities = foundMoney > 0 || microSuggestion > 0;
  const nothingNeedsAttention = !inEmergency && !displayedSTS.shortageRisk && !hasAtRisk && !hasOpportunities && !hasOverBudget;

  const bufferScore = Math.round(25 * Math.min(1, f.cash / Math.max(cashBuffer * 2, 1)));
  const debtScore = Math.round(25 * (1 - Math.min(1, income > 0 ? debtMonthly / income : 0)));
  const flowScore = displayedSTS.shortageRisk ? 10 : 25;
  const goalScore = goals.length === 0 ? 25 : Math.round(25 * (goals.reduce((s, g) => s + Math.min(1, g.target > 0 ? g.current / g.target : 1), 0) / goals.length));
  const healthScore = bufferScore + debtScore + flowScore + goalScore;
  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Healthy" : healthScore >= 40 ? "Needs Attention" : "At Risk";

  const debtsForChart = f.obligations.filter((o) => (o.balance ?? 0) > 0).map((o) => ({ label: o.label, balance: o.balance ?? 0, apr: o.apr ?? 0 }));

  // Obligation add/edit
  const [label, setLabel] = useState(""); const [kind, setKind] = useState<Obligation["kind"]>("other");
  const [frequency, setFrequency] = useState<ObligationFrequency>("monthly");
  const [amount, setAmount] = useState(""); const [dueDate, setDueDate] = useState("");
  const [apr, setApr] = useState(""); const [balance, setBalance] = useState("");
  const [isSubscription, setIsSubscription] = useState(false);
  function addObligation() {
    if (!label.trim() || !dueDate) return;
    setF({ obligations: [...f.obligations, { id: uid(), label: label.trim(), kind, frequency, amount: Number(amount) || 0, dueDate, apr: Number(apr) || undefined, balance: Number(balance) || undefined, isSubscription: isSubscription || undefined }] });
    setLabel(""); setAmount(""); setApr(""); setBalance(""); setDueDate(""); setFrequency("monthly"); setIsSubscription(false);
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Obligation>>(emptyEditForm);
  function startEdit(o: Obligation) { setEditingId(o.id); setEditForm({ ...o }); }
  function cancelEdit() { setEditingId(null); setEditForm(emptyEditForm); }
  function saveEdit() { if (!editingId) return; setF({ obligations: f.obligations.map((o) => (o.id === editingId ? { ...o, ...editForm, id: o.id } : o)) }); cancelEdit(); }

  const payoffOrder = sortByStrategy(f.obligations, debtStrategy);
  const [extraPayment, setExtraPayment] = useState("0");
  const topPayoff = payoffOrder[0];
  const topPayoffMonths = topPayoff ? Math.ceil((topPayoff.balance ?? 0) / Math.max(topPayoff.amount + (Number(extraPayment) || 0), 1)) : null;

  // Goals
  const [goalLabel, setGoalLabel] = useState(""); const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState(""); const [goalDeadline, setGoalDeadline] = useState("");
  function addGoal() {
    if (!goalLabel.trim() || !goalTarget) return;
    setF({ goals: [...goals, { id: uid(), label: goalLabel.trim(), target: Number(goalTarget) || 0, current: Number(goalCurrent) || 0, deadline: goalDeadline || undefined }] });
    setGoalLabel(""); setGoalTarget(""); setGoalCurrent(""); setGoalDeadline("");
  }
  function requiredPerPeriod(g: Goal) {
    if (!g.deadline) return null;
    const remaining = Math.max(0, g.target - g.current);
    const monthsLeft = (new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
    if (monthsLeft <= 0) return { amount: remaining, behindDeadline: remaining > 0 };
    return { amount: (remaining / monthsLeft) / periodsPerMonth(f.incomeType), behindDeadline: false };
  }
  function moveMicroSavings(goalId: string, amt: number) { setF({ cash: f.cash - amt, goals: goals.map((g) => (g.id === goalId ? { ...g, current: g.current + amt } : g)) }); }

  // Paycheck log
  const [pcDate, setPcDate] = useState(""); const [pcExpected, setPcExpected] = useState(""); const [pcActual, setPcActual] = useState("");
  function logPaycheck() {
    if (!pcDate || !pcActual) return;
    setF({ paychecks: [...paychecks, { id: uid(), date: pcDate, expectedAmount: Number(pcExpected) || Number(pcActual) || 0, actualAmount: Number(pcActual) || 0 }] });
    setPcDate(""); setPcExpected(""); setPcActual("");
  }

  // Transactions
  const [txLabel, setTxLabel] = useState(""); const [txCategory, setTxCategory] = useState<Transaction["category"]>("grocery");
  const [txAmount, setTxAmount] = useState(""); const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txStatus, setTxStatus] = useState<Transaction["status"]>("spent");
  function addTransaction() {
    if (!txLabel.trim() || !txAmount) return;
    const amt = Number(txAmount) || 0;
    setF({
      transactions: [...transactions, { id: uid(), label: txLabel.trim(), category: txCategory, amount: amt, date: txDate, status: txStatus }],
      cash: txStatus === "spent" ? f.cash - amt : f.cash,
    });
    setTxLabel(""); setTxAmount("");
  }

  // NEW — Category budgets
  const [budgetCategory, setBudgetCategory] = useState<Transaction["category"]>("grocery");
  const [budgetCap, setBudgetCap] = useState("");
  function setBudgetForCategory() {
    if (!budgetCap) return;
    setF({ categoryBudgets: { ...categoryBudgets, [budgetCategory]: Number(budgetCap) || 0 } });
    setBudgetCap("");
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
        <Banner icon={<AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />}
          title="Financial Emergency — cash is already below your buffer today"
          body={`Cash: ${money(f.cash)} · Buffer: ${money(cashBuffer)} · Shortfall: ${money(cashBuffer - f.cash)}. Priority: essential obligations, minimum debt, cash preservation — discretionary last.`} />
      )}
      {!inEmergency && displayedSTS.shortageRisk && (
        <Banner icon={<ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />}
          title="Projected cash-flow shortage"
          body={`Projected to dip below your ${money(cashBuffer)} buffer${displayedSTS.minProjectedDate ? ` around ${displayedSTS.minProjectedDate.toLocaleDateString()}` : ""}, low of ${money(displayedSTS.minProjectedBalance)}.`} />
      )}
      {hasOverBudget && (
        <Banner icon={<ShoppingBag className="mt-0.5 size-5 shrink-0 text-destructive" />}
          title="Over a category budget"
          body={budgetStatus.filter((b) => b.overCap).map((b) => `${b.category}: ${money(b.spent)} of ${money(b.cap)}`).join(" · ")} />
      )}
      {nothingNeedsAttention && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          You're on track. Nothing needs your attention right now.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tile title="Cash-flow forecast (60 days)" className="lg:col-span-2">
          <CashFlowChart timeline={displayedTimeline} cashBuffer={cashBuffer} />
        </Tile>
        <Tile title="Runway (30 / 90 / 180 days)">
          <RunwayChart runway={runway} cashBuffer={cashBuffer} />
        </Tile>
        <Tile title="Spending by category (30d)">
          <SpendingByCategoryChart data={categorySpend} />
        </Tile>
        <Tile title="Debt balances">
          <DebtBalanceChart debts={debtsForChart} />
        </Tile>
        <Tile title="Spending trend by month">
          <SpendTrendChart data={spendTrend.data} sufficientData={spendTrend.sufficientData} />
        </Tile>
      </div>

      {priorityQueue.length > 0 && (
        <Tile title="What needs to get paid first">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ListOrdered className="size-4" />
            Ranked essential-first, then due date — allocated against {money(f.cash)} cash on hand today.
          </div>
          <div className="space-y-2">
            {priorityQueue.map((p) => (
              <div key={p.obligation.id} className={`rounded-2xl px-3 py-2 ${p.status === "FUNDED" ? "bg-secondary" : p.status === "AT_RISK" ? "bg-amber-500/10" : "bg-destructive/10"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.obligation.label} — {money(p.obligation.amount)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${p.status === "FUNDED" ? "bg-emerald-500/15 text-emerald-500" : p.status === "AT_RISK" ? "bg-amber-500/15 text-amber-600" : "bg-destructive/15 text-destructive"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {PRIORITY_TIER_LABEL[p.tier]} · due in {daysUntil(p.obligation.dueDate)} day(s)
                  {p.status !== "FUNDED" && ` · short by ${money(p.shortfall)}`}
                </p>
              </div>
            ))}
          </div>
        </Tile>
      )}

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
                <span>About {money(spareSlack)} of extra flexibility beyond your buffer. <ConfidenceTag type="OPPORTUNITY" /></span>
                <Button size="sm" variant="outline" onClick={() => moveMicroSavings(earliestGoal.id, microSuggestion)}>Move {money(microSuggestion)} → {earliestGoal.label}</Button>
              </div>
            )}
          </div>
        </Tile>
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
              <span className="text-muted-foreground">Needs vs. income</span>
              <span className={needsRatio > 50 ? "font-semibold text-destructive" : "font-semibold"}>{needsRatio.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${needsRatio > 50 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${needsRatio}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Educational guideline (50/30/20 rule) — not enforced by the app.</p>
          </div>
        )}
      </Tile>

      {subscriptions.subs.length > 0 && (
        <Tile title="Subscriptions">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="size-4" />
            {money(subscriptions.monthlyTotal)}/mo across {subscriptions.subs.length} flagged subscription{subscriptions.subs.length === 1 ? "" : "s"}.
          </div>
          <div className="space-y-1.5">
            {subscriptions.subs.map((s) => (
              <div key={s.id} className="flex justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                <span>{s.label}</span>
                <span className="font-semibold">{money(monthlyEquivalent(s))}/mo</span>
              </div>
            ))}
          </div>
        </Tile>
      )}

      <Tile title="Category budgets">
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value as Transaction["category"])}>
            {TRANSACTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} placeholder="Monthly cap $" />
          <Button onClick={setBudgetForCategory}>Set budget</Button>
        </div>
        {budgetStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budgets set — these only apply to discretionary spending, separate from your bills above.</p>
        ) : (
          <div className="space-y-2">
            {budgetStatus.map((b) => (
              <div key={b.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{b.category}</span>
                  <span className={b.overCap ? "font-semibold text-destructive" : "font-semibold"}>{money(b.spent)} / {money(b.cap)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${b.overCap ? "bg-destructive" : "bg-primary"}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Tile>

      <Tile title="Groceries, one-time & travel spending">
        <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Input value={txLabel} onChange={(e) => setTxLabel(e.target.value)} placeholder="What was it?" />
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={txCategory} onChange={(e) => setTxCategory(e.target.value as Transaction["category"])}>
            {TRANSACTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Amount $" />
          <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
          <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={txStatus} onChange={(e) => setTxStatus(e.target.value as Transaction["status"])}>
            <option value="spent">Already spent</option>
            <option value="planned">Planned (future)</option>
          </select>
          <Button onClick={addTransaction}><ShoppingBag className="mr-1 size-4" />Log</Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet — spent items reduce Safe to Spend immediately; planned trips or purchases reduce it ahead of time.</p>
        ) : (
          <div className="space-y-1.5">
            {[...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</span>
                <span className="flex-1 px-3">{t.label} · {t.category}</span>
                <span>{t.status === "planned" ? <ConfidenceTag type="SCENARIO" /> : <ConfidenceTag type="HISTORICAL" />}</span>
                <span className="w-20 text-right font-semibold">{money(t.amount)}</span>
              </div>
            ))}
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
          <p className="text-sm text-muted-foreground">Log a few paychecks to unlock variability range and found-money detection.</p>
        ) : (
          <div className="space-y-1.5">
            {recentPaychecks.map((p) => (
              <div key={p.id} className="flex justify-between rounded-xl bg-secondary/60 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString()}</span>
                <span>expected {money(p.expectedAmount)}</span>
                <span className="font-semibold">actual {money(p.actualAmount)}</span>
              </div>
            ))}
            {paycheckRange && <p className="pt-1 text-xs text-muted-foreground">Recent range {money(paycheckRange.min)}–{money(paycheckRange.max)} <ConfidenceTag type="ESTIMATE" /></p>}
          </div>
        )}
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
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={isSubscription} onChange={(e) => setIsSubscription(e.target.checked)} />
          This is a subscription
        </label>
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
                  <p className="text-sm font-semibold">{o.label}{o.isSubscription ? " · subscription" : ""}</p>
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
              <div className="space-y-1.5"><Label className="text-xs uppercase">Extra payment toward #1 ({topPayoff?.label})</Label><Input value={extraPayment} onChange={(e) => setExtraPayment(e.target.value)} inputMode="decimal" /></div>
              {topPayoffMonths !== null && <p className="pb-2 text-xs text-muted-foreground">→ ~{topPayoffMonths} payments to clear at this rate</p>}
            </div>
            <ol className="space-y-2">
              {payoffOrder.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-accent px-3 py-2 text-accent-foreground">
                  <span className="font-display text-lg font-bold">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{o.label}</p>
                    <p className="text-xs opacity-80">{money(o.balance ?? 0)} at {o.apr ?? 0}% · {o.amount ? `~${Math.ceil((o.balance ?? 0) / Math.max(o.amount + (i === 0 ? Number(extraPayment) || 0 : 0), 1))} payments` : "increase payment to clear faster"}</p>
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
          <div className="flex gap-2"><Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} /><Button onClick={addGoal} size="icon"><Target className="size-4" /></Button></div>
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
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {money(g.current)} / {money(g.target)} ({pct.toFixed(0)}%){g.deadline && ` · target ${new Date(g.deadline).toLocaleDateString()}`}
                    {req && !req.behindDeadline && ` · needs ~${money(req.amount)} per paycheck`}
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
          <div className="space-y-1.5"><Label className="text-xs uppercase">Hypothetical income amount</Label><Input value={scenarioIncome} onChange={(e) => setScenarioIncome(e.target.value)} inputMode="decimal" /></div>
          <Button variant={scenarioActive ? "default" : "outline"} onClick={() => setScenarioActive((v) => !v)}><TrendingUp className="mr-2 size-4" />{scenarioActive ? "Viewing scenario — click to exit" : "Run scenario"}</Button>
          {scenarioActive && <ConfidenceTag type="SCENARIO" />}
        </div>
        {scenarioActive && scenarioSafeToSpend && (
          <p className="text-sm text-muted-foreground">
            At {money(Number(scenarioIncome) || 0)} per paycheck, safe-to-spend becomes <span className="font-semibold text-foreground">{money(scenarioSafeToSpend.safeToSpend)}</span> (currently {money(liveSafeToSpend.safeToSpend)}) — a difference of{" "}
            <span className={scenarioSafeToSpend.safeToSpend >= liveSafeToSpend.safeToSpend ? "text-emerald-500" : "text-destructive"}>{money(scenarioSafeToSpend.safeToSpend - liveSafeToSpend.safeToSpend)}</span>. Nothing here is saved until you update your actual income above.
          </p>
        )}
      </Tile>

      <Tile title="Financial health">
        <div className="mb-3 flex items-center gap-4">
          <div className="font-display text-4xl font-bold">{healthScore}</div>
          <div><p className="text-sm font-semibold">{healthLabel}</p><p className="text-xs text-muted-foreground">Every point below is shown — nothing here is a hidden weight.</p></div>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-4">
          <ScoreRow label="Cash buffer" score={bufferScore} />
          <ScoreRow label="Debt burden" score={debtScore} />
          <ScoreRow label="Cash-flow stability" score={flowScore} />
          <ScoreRow label="Goal progress" score={goalScore} />
        </div>
      </Tile>
    </div>
  );
}

function Banner({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
      {icon}
      <div><p className="text-sm font-semibold text-destructive">{title}</p><p className="text-xs text-muted-foreground">{body}</p></div>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return <div className="rounded-xl bg-secondary/60 px-3 py-2"><p className="text-muted-foreground">{label}</p><p className="font-semibold">{score} / 25</p></div>;
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-3xl border border-border bg-card px-4 py-3 shadow-tile">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
