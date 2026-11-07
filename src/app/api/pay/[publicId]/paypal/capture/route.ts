import { error, handle, json, readJson } from "@/lib/http";
import { captureOrder, paypalEnabled } from "@/lib/paypal";
import { getInvoiceByPublicId, markPaid } from "@/lib/store";

type Ctx = { params: Promise<{ publicId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    if (!paypalEnabled()) return error("PayPal is not configured", 400);
    const invoice = await getInvoiceByPublicId((await params).publicId);
    if (!invoice) return error("Invoice not found", 404);
    if (invoice.status === "paid") return json({ invoice });
    const { orderId } = await readJson(req);
    if (typeof orderId !== "string" || orderId !== invoice.paypal_order_id) return error("Unknown PayPal order for this invoice", 400);
    const { captureId, payer } = await captureOrder(orderId, invoice);
    const paid = await markPaid(invoice.id, "paypal", { orderId, captureId, payer });
    return json({ invoice: paid });
  });
}
