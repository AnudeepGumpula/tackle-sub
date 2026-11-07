import { handle, json, readJson } from "@/lib/http";
import { getSettings, updateSettings } from "@/lib/store";
import { settingsInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => json({ settings: await getSettings() }));
}

export async function PUT(req: Request) {
  return handle(async () => {
    const patch = settingsInput.parse(await readJson(req));
    return json({ settings: await updateSettings(patch) });
  });
}
