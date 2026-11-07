import { handle, json, readJson, error } from "@/lib/http";
import { getSavings, TOOLS, updateSavings } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => json({ savings: await getSavings(), tools: TOOLS }));
}

export async function PUT(req: Request) {
  return handle(async () => {
    const { tool, monthly } = await readJson(req);
    if (typeof tool !== "string" || !TOOLS.some((t) => t.key === tool)) return error("Pick one of the listed tools");
    await updateSavings(tool, monthly === undefined || monthly === "" ? undefined : Number(monthly));
    return json({ savings: await getSavings() });
  });
}
