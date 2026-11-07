import { error, handle, json, readJson } from "@/lib/http";
import { resetAll, seedDemo } from "@/lib/store";

export async function POST(req: Request) {
  return handle(async () => {
    const { action } = await readJson(req);
    if (action === "seed") await seedDemo();
    else if (action === "reset") await resetAll();
    else return error("action must be 'seed' or 'reset'");
    return json({ ok: true });
  });
}
