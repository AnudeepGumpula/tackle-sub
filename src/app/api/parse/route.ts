import { parseSentence } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { error, handle, json, readJson } from "@/lib/http";
import { clientDirectory, getSettings } from "@/lib/store";

export async function POST(req: Request) {
  return handle(async () => {
    const { text } = await readJson(req);
    if (typeof text !== "string" || !text.trim()) return error("Type a sentence describing the invoice");
    if (text.length > 2000) return error("That's a long one. Keep it under 2000 characters");
    const [settings, knownClients] = await Promise.all([getSettings(), clientDirectory()]);
    const { draft, warning } = await parseSentence(text.trim(), {
      today: todayISO(),
      currency: settings.currency,
      defaultTaxRate: settings.default_tax_rate,
      paymentTermsDays: settings.payment_terms_days,
      knownClients,
    });
    return json({ draft, warning });
  });
}
