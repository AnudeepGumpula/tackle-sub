import { getSettings } from "@/lib/store";
import { ImportForm } from "@/components/ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Switch in 60 seconds</h1>
        <p className="mt-1 text-slate-500">Bring your clients and open invoices from FreshBooks, QuickBooks or Wave. Then cancel the subscription.</p>
      </div>
      <ImportForm currency={settings.currency} />
    </div>
  );
}
