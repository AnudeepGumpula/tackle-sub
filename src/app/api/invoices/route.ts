import { handle, json, readJson } from "@/lib/http";
import { createInvoice, listInvoices } from "@/lib/store";
import { invoiceInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => json({ invoices: await listInvoices() }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = invoiceInput.parse(await readJson(req));
    const invoice = await createInvoice(input);
    return json({ invoice }, 201);
  });
}
