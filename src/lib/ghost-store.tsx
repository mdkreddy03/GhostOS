import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ---------------------------------- types --------------------------------- */

export type Account = {
  username: string;
  email: string;
  passcode: string;
  avatar: string;
  gender: "male" | "female";
  remember: boolean;
};

export type Profile = {
  fullName: string;
  location: string;
  occupation: string;
  birthday: string;
  timezone: string;
  goals: string;
  vibe: string;
};

export type Todo = {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd
  done: boolean;
  note?: string | undefined;
};

export type Reminder = {
  id: string;
  title: string;
  date: string;
  time: string;
  note?: string;
};

export type Note = { id: string; title: string; body: string; updatedAt: number };

export type Obligation = {
  id: string;
  label: string;
  kind: "auto-insurance" | "credit-card" | "debt" | "auto-loan" | "rent" | "other";
  amount: number;
  dueDate: string; // yyyy-mm-dd
  balance?: number | undefined;
  apr?: number | undefined;
};

export type Finance = {
  incomeAmount: number;
  incomeType: "hourly" | "biweekly" | "monthly";
  hoursPerWeek: number;
  cash: number;
  obligations: Obligation[];
};

export type HealthEntry = { id: string; date: string; weight: number; note: string };

export type Health = {
  heightCm: number;
  weightKg: number;
  age: number;
  sex: "male" | "female" | "other";
  conditions: string;
  medications: string;
  activity: "low" | "moderate" | "high";
  entries: HealthEntry[];
};

export type Grocery = { id: string; item: string; category: string; favorite: boolean };

export type GhostState = {
  account: Account | null;
  profile: Profile;
  onboarded: boolean;
  todos: Todo[];
  reminders: Reminder[];
  notes: Note[];
  finance: Finance;
  health: Health;
  grocery: Grocery[];
  savedRecipes: { id: string; title: string; body: string }[];
};

const STORAGE_KEY = "ghost-os-v1";

export const emptyState: GhostState = {
  account: null,
  onboarded: false,
  profile: {
    fullName: "",
    location: "",
    occupation: "",
    birthday: "",
    timezone: "",
    goals: "",
    vibe: "",
  },
  todos: [],
  reminders: [],
  notes: [],
  finance: {
    incomeAmount: 0,
    incomeType: "biweekly",
    hoursPerWeek: 40,
    cash: 0,
    obligations: [],
  },
  health: {
    heightCm: 0,
    weightKg: 0,
    age: 0,
    sex: "other",
    conditions: "",
    medications: "",
    activity: "moderate",
    entries: [],
  },
  grocery: [],
  savedRecipes: [],
};

/* --------------------------------- context -------------------------------- */

type Ctx = {
  state: GhostState;
  hydrated: boolean;
  update: (patch: Partial<GhostState> | ((s: GhostState) => Partial<GhostState>)) => void;
  reset: () => void;
};

const GhostContext = createContext<Ctx | null>(null);

export function GhostProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GhostState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GhostState>;
        setState({
          ...emptyState,
          ...parsed,
          profile: { ...emptyState.profile, ...(parsed.profile ?? {}) },
          finance: { ...emptyState.finance, ...(parsed.finance ?? {}) },
          health: { ...emptyState.health, ...(parsed.health ?? {}) },
        });
      }
    } catch {
      /* keep defaults — never destroy stored data */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state, hydrated]);

  const update = useCallback<Ctx["update"]>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  const reset = useCallback(() => setState(emptyState), []);

  const value = useMemo(() => ({ state, hydrated, update, reset }), [state, hydrated, update, reset]);
  return <GhostContext.Provider value={value}>{children}</GhostContext.Provider>;
}

export function useGhost() {
  const ctx = useContext(GhostContext);
  if (!ctx) throw new Error("useGhost must be used inside GhostProvider");
  return ctx;
}

/* --------------------------------- helpers -------------------------------- */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const daysUntil = (iso: string) => {
  if (!iso) return 9999;
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
};

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function monthlyIncome(f: Finance) {
  if (f.incomeType === "hourly") return f.incomeAmount * f.hoursPerWeek * 52 / 12;
  if (f.incomeType === "biweekly") return (f.incomeAmount * 26) / 12;
  return f.incomeAmount;
}

export type PriorityItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  days: number;
  source: "task" | "reminder" | "payment";
};

export function buildPriorities(state: GhostState): PriorityItem[] {
  const items: PriorityItem[] = [];
  state.todos
    .filter((t) => !t.done)
    .forEach((t) =>
      items.push({
        id: t.id,
        title: t.title,
        detail: t.note || "Task",
        date: t.date,
        days: daysUntil(t.date),
        source: "task",
      }),
    );
  state.reminders.forEach((r) =>
    items.push({
      id: r.id,
      title: r.title,
      detail: r.time ? `Reminder · ${r.time}` : "Reminder",
      date: r.date,
      days: daysUntil(r.date),
      source: "reminder",
    }),
  );
  state.finance.obligations.forEach((o) =>
    items.push({
      id: o.id,
      title: o.label,
      detail: `${money(o.amount)} due`,
      date: o.dueDate,
      days: daysUntil(o.dueDate),
      source: "payment",
    }),
  );
  return items.sort((a, b) => a.days - b.days);
}

export function bucket(days: number): "high" | "medium" | "low" {
  if (days <= 0) return "high";
  if (days <= 7) return "medium";
  return "low";
}
