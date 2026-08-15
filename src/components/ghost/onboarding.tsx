import { useState } from "react";

import { useGhost, uid, type Obligation } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const MALE = ["🧑🏽", "👨🏻", "👨🏾", "🧔🏽", "👨🏼‍💻", "🕺"];
const FEMALE = ["👩🏽", "👩🏻", "👩🏾", "👩🏼‍🦰", "👩🏽‍💻", "💃"];

const STEPS = ["Account", "Avatar", "You", "Money", "Health"];

export function Onboarding() {
  const { update } = useGhost();
  const [step, setStep] = useState(0);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [remember, setRemember] = useState(true);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [avatar, setAvatar] = useState(MALE[0]!);

  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [occupation, setOccupation] = useState("");
  const [birthday, setBirthday] = useState("");
  const [goals, setGoals] = useState("");
  const [vibe, setVibe] = useState("");

  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeType, setIncomeType] = useState<"hourly" | "biweekly" | "monthly">("biweekly");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  const [cash, setCash] = useState("");
  const [obligations, setObligations] = useState<Obligation[]>([]);

  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");

  const canNext = step === 0 ? username.trim() && email.trim() && passcode.length >= 4 : true;

  function finish() {
    update({
      account: { username: username.trim(), email: email.trim(), passcode, avatar, gender, remember },
      profile: {
        fullName,
        location,
        occupation,
        birthday,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goals,
        vibe,
      },
      finance: {
        incomeAmount: Number(incomeAmount) || 0,
        incomeType,
        hoursPerWeek: Number(hoursPerWeek) || 0,
        cash: Number(cash) || 0,
        obligations,
      },
      health: {
        heightCm: Number(heightCm) || 0,
        weightKg: Number(weightKg) || 0,
        age: Number(age) || 0,
        sex: gender,
        conditions,
        medications,
        activity: "moderate",
        entries: [],
      },
      onboarded: true,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-tile sm:p-8">
        <p className="font-display text-2xl font-bold tracking-tight">
          Ghost<span className="text-primary">OS</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your whole life in one quiet place. Everything you enter stays on this device until you change it.
        </p>

        <div className="mt-5 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-secondary")}
            />
          ))}
        </div>
        <p className="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>

        <div className="mt-6 space-y-4">
          {step === 0 && (
            <>
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ghostrider" />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                />
              </Field>
              <Field label="Passcode (4+ characters)">
                <Input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Save login on this device
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setGender(g);
                      setAvatar((g === "male" ? MALE : FEMALE)[0]!);
                    }}
                    className={cn(
                      "flex-1 rounded-2xl border px-3 py-2 text-sm capitalize",
                      gender === g ? "border-primary bg-accent text-accent-foreground" : "border-border",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(gender === "male" ? MALE : FEMALE).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    className={cn(
                      "aspect-square rounded-2xl border text-2xl",
                      avatar === a ? "border-primary bg-accent" : "border-border",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="City (used for weather)">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Occupation">
                  <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                </Field>
                <Field label="Birthday">
                  <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                </Field>
              </div>
              <Field label="Goals">
                <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} />
              </Field>
              <Field label="Your vibe / how Ghost should talk to you">
                <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="direct, no fluff" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Income amount">
                  <Input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} inputMode="decimal" />
                </Field>
                <Field label="Paid">
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={incomeType}
                    onChange={(e) => setIncomeType(e.target.value as typeof incomeType)}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours / week">
                  <Input value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Cash on hand">
                  <Input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <div className="space-y-2">
                <Label>Bills & debts</Label>
                {obligations.map((o, i) => (
                  <div key={o.id} className="grid grid-cols-[1fr_5rem_8rem] gap-2">
                    <Input
                      placeholder="Car insurance"
                      value={o.label}
                      onChange={(e) =>
                        setObligations((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                    />
                    <Input
                      placeholder="$"
                      value={o.amount || ""}
                      onChange={(e) =>
                        setObligations((list) =>
                          list.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)),
                        )
                      }
                    />
                    <Input
                      type="date"
                      value={o.dueDate}
                      onChange={(e) =>
                        setObligations((list) => list.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setObligations((l) => [
                      ...l,
                      { id: uid(), label: "", kind: "other", amount: 0, dueDate: "" },
                    ])
                  }
                >
                  Add a bill
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Height (cm)">
                  <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Weight (kg)">
                  <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Age">
                  <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
                </Field>
              </div>
              <Field label="Health conditions">
                <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} />
              </Field>
              <Field label="Medications">
                <Textarea value={medications} onChange={(e) => setMedications(e.target.value)} rows={2} />
              </Field>
              <p className="text-xs text-muted-foreground">
                You can edit or clear any of this later in Settings — nothing is deleted on its own.
              </p>
            </>
          )}
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue
            </Button>
          ) : (
            <Button onClick={finish}>Enter Ghost OS</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs tracking-wide text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  );
}
