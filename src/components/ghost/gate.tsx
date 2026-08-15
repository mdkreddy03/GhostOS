import type { ReactNode } from "react";

import { useGhost } from "@/lib/ghost-store";
import { Onboarding } from "./onboarding";
import { Shell } from "./shell";

export function Gate({ children }: { children: ReactNode }) {
  const { state, hydrated } = useGhost();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-sm text-muted-foreground">Waking Ghost OS…</p>
      </div>
    );
  }

  if (!state.onboarded || !state.account) return <Onboarding />;

  return <Shell>{children}</Shell>;
}
