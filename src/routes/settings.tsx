import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { Gate } from "@/components/ghost/gate";
import { Tile } from "@/components/ghost/shell";
import { useGhost } from "@/lib/ghost-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ghost OS" },
      { name: "description", content: "Edit your account, profile and city, export your data or reset Ghost OS." },
      { property: "og:title", content: "Settings — Ghost OS" },
      { property: "og:description", content: "Control your Ghost OS account and data." },
    ],
  }),
  component: () => (
    <Gate>
      <SettingsPage />
    </Gate>
  ),
});

function SettingsPage() {
  const { state, update, reset } = useGhost();
  const account = state.account!;
  const p = state.profile;

  const setP = (patch: Partial<typeof p>) => update((s) => ({ profile: { ...s.profile, ...patch } }));
  const setA = (patch: Partial<typeof account>) =>
    update((s) => ({ account: { ...s.account!, ...patch } }));

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghost-os-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <Tile title="Account">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Username">
            <Input value={account.username} onChange={(e) => setA({ username: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={account.email} onChange={(e) => setA({ email: e.target.value })} />
          </Field>
          <Field label="Passcode">
            <Input type="password" value={account.passcode} onChange={(e) => setA({ passcode: e.target.value })} />
          </Field>
        </div>
      </Tile>

      <Tile title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={p.fullName} onChange={(e) => setP({ fullName: e.target.value })} />
          </Field>
          <Field label="City (weather)">
            <Input value={p.location} onChange={(e) => setP({ location: e.target.value })} />
          </Field>
          <Field label="Occupation">
            <Input value={p.occupation} onChange={(e) => setP({ occupation: e.target.value })} />
          </Field>
          <Field label="Birthday">
            <Input type="date" value={p.birthday} onChange={(e) => setP({ birthday: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Goals">
            <Textarea rows={2} value={p.goals} onChange={(e) => setP({ goals: e.target.value })} />
          </Field>
          <Field label="Vibe">
            <Input value={p.vibe} onChange={(e) => setP({ vibe: e.target.value })} />
          </Field>
        </div>
      </Tile>

      <Tile title="Your data">
        <p className="text-sm text-muted-foreground">
          Everything lives on this device and is never deleted unless you do it here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            Export backup
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Erase all Ghost OS data on this device?")) {
                reset();
                toast("Ghost OS reset");
              }
            }}
          >
            Reset Ghost OS
          </Button>
        </div>
      </Tile>
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
