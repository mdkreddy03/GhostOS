// components/finance/charts.tsx — FULL FILE
// npm install recharts

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { TimelinePoint, CategorySpend, MonthlySpendPoint } from "@/lib/finance-engine";
import { money } from "@/lib/finance-engine";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899"];

export function CashFlowChart({ timeline, cashBuffer }: { timeline: TimelinePoint[]; cashBuffer: number }) {
  const data = timeline.map((p) => ({ date: p.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), balance: Math.round(p.projectedBalance) }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Add income and obligations to see a projection.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={64} />
        <Tooltip formatter={(v: number) => money(v)} />
        <ReferenceLine y={cashBuffer} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Buffer", fontSize: 10, fill: "#ef4444" }} />
        <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RunwayChart({ runway, cashBuffer }: { runway: { days: number; projected: number }[]; cashBuffer: number }) {
  const data = runway.map((r) => ({ label: `${r.days}d`, projected: Math.round(r.projected) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={64} />
        <Tooltip formatter={(v: number) => money(v)} />
        <ReferenceLine y={cashBuffer} stroke="#ef4444" strokeDasharray="4 4" />
        <Bar dataKey="projected" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.projected < cashBuffer ? "#ef4444" : "#6366f1"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendingByCategoryChart({ data }: { data: CategorySpend[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No categorized spending yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={85} label={(d) => d.category}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number) => money(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DebtBalanceChart({ debts }: { debts: { label: string; balance: number; apr: number }[] }) {
  if (debts.length === 0) return <p className="text-sm text-muted-foreground">No debt balances tracked yet.</p>;
  const data = debts.map((d) => ({ label: d.label, balance: d.balance, apr: d.apr }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
        <Tooltip formatter={(v: number, n: string, p: any) => [money(v), `${p.payload.apr}% APR`]} />
        <Bar dataKey="balance" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.apr >= 20 ? "#ef4444" : d.apr >= 10 ? "#f59e0b" : "#6366f1"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// NEW — month-over-month spend trend
export function SpendTrendChart({ data, sufficientData }: { data: MonthlySpendPoint[]; sufficientData: boolean }) {
  if (!sufficientData) {
    return <p className="text-sm text-muted-foreground">Log spending across at least 2 months to unlock this trend — one month alone can't show a pattern.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={64} />
        <Tooltip formatter={(v: number) => money(v)} />
        <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}