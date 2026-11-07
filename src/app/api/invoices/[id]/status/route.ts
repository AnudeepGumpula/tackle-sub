import { error, handle, json, readJson } from "@/lib/http";
import { markPaid, setStatus } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { status } = await readJson(req);
    try {
      let invoice;
      if (status === "paid") invoice = await markPaid(id, "manual");
      else if (status === "sent" || status === "draft" || status === "void") invoice = await setStatus(id, status);
      else return error("Status must be one of: sent, draft, void, paid");
      return invoice ? json({ invoice }) : error("Invoice not found", 404);
    } catch (err) {
      return error(err instanceof Error ? err.message : "Could not change status", 409);
    }
  });
}
