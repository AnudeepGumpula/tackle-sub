import { error, handle, json } from "@/lib/http";
import { createOrder, paypalEnabled } from "@/lib/paypal";
import { getInvoiceByPublicId, savePaypalOrder } from "@/lib/store";

type Ctx = { params: Promise<{ publicId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  return handle(async () => {
    if (!paypalEnabled()) return error("PayPal is not configured", 400);
    const invoice = await getInvoiceByPublicId((await params).publicId);
    if (!invoice) return error("Invoice not found", 404);
    if (invoice.status === "paid") return error("This invoice is already paid", 409);
    if (invoice.status === "void") return error("This invoice was voided", 409);
    if (invoice.total_cents <= 0) return error("Nothing to pay on this invoice", 400);
    const orderId = await createOrder(invoice);
    await savePaypalOrder(invoice.id, orderId);
    return json({ orderId });
  });
}
