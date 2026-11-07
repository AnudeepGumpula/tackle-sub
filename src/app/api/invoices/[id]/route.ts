import { error, handle, json, readJson } from "@/lib/http";
import { deleteInvoice, getInvoice, updateInvoice } from "@/lib/store";
import { invoiceInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const invoice = await getInvoice((await params).id);
    return invoice ? json({ invoice }) : error("Invoice not found", 404);
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const input = invoiceInput.parse(await readJson(req));
    try {
      const invoice = await updateInvoice((await params).id, input);
      return invoice ? json({ invoice }) : error("Invoice not found", 404);
    } catch (err) {
      return error(err instanceof Error ? err.message : "Could not update", 409);
    }
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const ok = await deleteInvoice((await params).id);
    return ok ? json({ ok: true }) : error("Invoice not found", 404);
  });
}
