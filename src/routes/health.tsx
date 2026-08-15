import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost, uid, todayISO } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Health — Ghost OS" },
      { name: "description", content: "Track weight, BMI, conditions and medications, and log how you feel each day." },
      { property: "og:title", content: "Health — Ghost OS" },
      { property: "og:description", content: "Your body's dashboard inside Ghost OS." },
    ],
  }),
  component: () => (
    <Gate>
      <HealthPage />
    </Gate>
  ),
});

function HealthPage() {
  const { state, update } = useGhost();
  const h = state.health;
  const setH = (patch: Partial<typeof h>) => update((s) => ({ health: { ...s.health, ...patch } }));

  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  const bmi = h.heightCm && h.weightKg ? h.weightKg / (h.heightCm / 100) ** 2 : 0;
  const bmiLabel = bmi < 18.5 ? "underweight" : bmi < 25 ? "healthy" : bmi < 30 ? "overweight" : "obese";

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Health</h1>

      <Tile title="Body">
        <div className="grid gap-3 sm:grid-cols-4">
          <FieldNum label="Height (cm)" value={h.heightCm} onChange={(v) => setH({ heightCm: v })} />
          <FieldNum label="Weight (kg)" value={h.weightKg} onChange={(v) => setH({ weightKg: v })} />
          <FieldNum label="Age" value={h.age} onChange={(v) => setH({ age: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase">Activity</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={h.activity}
              onChange={(e) => setH({ activity: e.target.value as typeof h.activity })}
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        {bmi > 0 && (
          <p className="mt-4 rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            BMI {bmi.toFixed(1)} — {bmiLabel}
          </p>
        )}
      </Tile>

      <div className="grid gap-5 md:grid-cols-2">
        <Tile title="Conditions">
          <Textarea rows={4} value={h.conditions} onChange={(e) => setH({ conditions: e.target.value })} />
        </Tile>
        <Tile title="Medications">
          <Textarea rows={4} value={h.medications} onChange={(e) => setH({ medications: e.target.value })} />
        </Tile>
      </div>

      <Tile title="Daily log">
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
          <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight kg" />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="How do you feel today?" />
          <Button
            onClick={() => {
              if (!weight && !note) return;
              setH({
                entries: [
                  { id: uid(), date: todayISO(), weight: Number(weight) || 0, note },
                  ...h.entries,
                ],
              });
              setWeight("");
              setNote("");
            }}
          >
            <Plus className="size-4" /> Log
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {h.entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3 py-2 text-sm">
              <span className="w-24 text-muted-foreground">{e.date}</span>
              <span className="font-semibold">{e.weight ? `${e.weight} kg` : ""}</span>
              <span className="flex-1 text-muted-foreground">{e.note}</span>
              <button
                aria-label="Delete entry"
                onClick={() => setH({ entries: h.entries.filter((x) => x.id !== e.id) })}
              >
                <Trash2 className="size-4 opacity-60" />
              </button>
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}

function FieldNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase">{label}</Label>
      <Input inputMode="numeric" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
