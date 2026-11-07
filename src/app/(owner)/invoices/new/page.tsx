import { aiEnabled } from "@/lib/ai";
import { addDays, todayISO } from "@/lib/dates";
import { getSettings } from "@/lib/store";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import { MagicCreate } from "@/components/MagicCreate";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">New invoice</h1>
        <p className="mt-1 text-slate-500">Describe it in one sentence…</p>
        <div className="mt-4"><MagicCreate aiEnabled={aiEnabled()} autoFocus /></div>
      </section>
      <section>
        <p className="mb-3 text-slate-500">…or fill it in by hand.</p>
        <InvoiceEditor
          initial={{
            client_name: "",
            client_email: null,
            line_items: [{ kind: "flat_fee", description: "", quantity: 1, unit_price: 0 }],
            due_date: addDays(todayISO(), s.payment_terms_days),
            tax_rate: s.default_tax_rate,
            currency: s.currency,
            notes: null,
          }}
        />
      </section>
    </div>
  );
}
