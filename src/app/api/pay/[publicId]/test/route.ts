import { error, handle, json } from "@/lib/http";
import { testPaymentsEnabled } from "@/lib/paypal";
import { getInvoiceByPublicId, markPaid } from "@/lib/store";

type Ctx = { params: Promise<{ publicId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    if (!testPaymentsEnabled()) return error("Test payments are turned off", 403);
    const invoice = await getInvoiceByPublicId((await params).publicId);
    if (!invoice) return error("Invoice not found", 404);
    if (invoice.status === "void") return error("This invoice was voided", 409);
    const paid = await markPaid(invoice.id, "test");
    return json({ invoice: paid });
  });
}
