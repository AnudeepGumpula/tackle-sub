import { draftReminder, type ReminderTone } from "@/lib/ai";
import { todayISO } from "@/lib/dates";
import { baseUrlFrom, error, handle, json, readJson } from "@/lib/http";
import { addEvent, getInvoice, getSettings } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson(req);
    const tone: ReminderTone = body.tone === "firm" || body.tone === "final" ? body.tone : "friendly";
    const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
    if (!invoice) return error("Invoice not found", 404);
    if (invoice.status === "paid") return error("This invoice is already paid", 409);
    const payUrl = `${baseUrlFrom(req.headers)}/pay/${invoice.public_id}`;
    const reminder = await draftReminder(invoice, settings, payUrl, tone, todayISO());
    await addEvent(id, "reminder", `Drafted a ${tone} reminder`);
    return json({ reminder });
  });
}
