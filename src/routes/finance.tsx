import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid, money, monthlyIncome, daysUntil, type Obligation } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KINDS: Obligation["kind"][] = ["auto-insurance", "credit-card", "debt", "auto-loan", "rent", "other"];

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance Engine — Ghost OS" },
      { name: "description", content: "Track income, bills, debt payoff order and what's actually left each month." },
      { property: "og:title", content: "Finance Engine — Ghost OS" },
      { property: "og:description", content: "Income, bills and payoff strategy in one view." },
    ],
  }),
  component: () => (
    <Gate>
      <FinancePage />
    </Gate>
  ),
});

function FinancePage() {
  const { state, update } = useGhost();
  const f = state.finance;
  const income = monthlyIncome(f);
  const owed = f.obligations.reduce((s, o) => s + o.amount, 0);
  const left = income - owed;

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Obligation["kind"]>("other");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [apr, setApr] = useState("");
  const [balance, setBalance] = useState("");

  const setF = (patch: Partial<typeof f>) => update((s) => ({ finance: { ...s.finance, ...patch } }));

  function addObligation() {
    if (!label.trim()) return;
    setF({
      obligations: [
        ...f.obligations,
        {
          id: uid(),
          label: label.trim(),
          kind,
          amount: Number(amount) || 0,
          dueDate,
          apr: Number(apr) || undefined,
          balance: Number(balance) || undefined,
        },
      ],
    });
    setLabel("");
    setAmount("");
    setApr("");
    setBalance("");
  }

  const payoffOrder = [...f.obligations]
    .filter((o) => (o.balance ?? 0) > 0)
    .sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Finance Engine</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Monthly income" value={money(income)} />
        <Stat label="Monthly obligations" value={money(owed)} />
        <Stat label="Left over" value={money(left)} danger={left < 0} />
        <Stat label="Cash on hand" value={money(f.cash)} />
      </div>

      <Tile title="Income">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Amount</Label>
            <Input
              value={f.incomeAmount || ""}
              onChange={(e) => setF({ incomeAmount: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Type</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={f.incomeType}
              onChange={(e) => setF({ incomeType: e.target.value as typeof f.incomeType })}
            >
              <option value="hourly">Hourly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Hours / week</Label>
            <Input
              value={f.hoursPerWeek || ""}
              onChange={(e) => setF({ hoursPerWeek: Number(e.target.value) || 0 })}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Cash on hand</Label>
            <Input
              value={f.cash || ""}
              onChange={(e) => setF({ cash: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </div>
        </div>
      </Tile>

      <Tile title="Add a bill, card or loan">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as Obligation["kind"])}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace("-", " ")}
              </option>
            ))}
          </select>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monthly $" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Balance $" />
          <div className="flex gap-2">
            <Input value={apr} onChange={(e) => setApr(e.target.value)} placeholder="APR %" />
            <Button onClick={addObligation} size="icon">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </Tile>

      <Tile title={`Obligations (${f.obligations.length})`}>
        <div className="space-y-2">
          {f.obligations.length === 0 && <p className="text-sm text-muted-foreground">Nothing tracked yet.</p>}
          {[...f.obligations]
            .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
            .map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.kind.replace("-", " ")} · {money(o.amount)}/mo · due {o.dueDate || "—"}
                    {o.balance ? ` · balance ${money(o.balance)}` : ""}
                    {o.apr ? ` · ${o.apr}% APR` : ""}
                  </p>
                </div>
                <button
                  aria-label="Delete obligation"
                  onClick={() => setF({ obligations: f.obligations.filter((x) => x.id !== o.id) })}
                >
                  <Trash2 className="size-4 opacity-60" />
                </button>
              </div>
            ))}
        </div>
      </Tile>

      <Tile title="Payoff order (highest APR first)">
        {payoffOrder.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add balances and APRs to get a payoff plan.</p>
        ) : (
          <ol className="space-y-2">
            {payoffOrder.map((o, i) => (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-accent px-3 py-2 text-accent-foreground">
                <span className="font-display text-lg font-bold">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-xs opacity-80">
                    {money(o.balance ?? 0)} at {o.apr ?? 0}% ·{" "}
                    {left > 0 && o.amount
                      ? `~${Math.ceil((o.balance ?? 0) / Math.max(o.amount, 1))} months at current payment`
                      : "increase payment to clear faster"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Tile>
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
