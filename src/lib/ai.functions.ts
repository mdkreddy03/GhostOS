import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ghostAi = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        system: z.string(),
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: "AI is not configured yet." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: data.system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { text: `Ghost AI could not respond right now (${res.status}). ${detail.slice(0, 160)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content ?? "No response." };
  });
