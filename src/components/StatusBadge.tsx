import type { DisplayStatus } from "@/lib/types";

const STYLES: Record<DisplayStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-700" },
  sent: { label: "Awaiting payment", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  void: { label: "Void", cls: "bg-slate-100 text-slate-500 line-through" },
};

export function StatusBadge({ status, className = "" }: { status: DisplayStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span data-testid="invoice-status" data-status={status} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls} ${className}`}>
      {s.label}
    </span>
  );
}
