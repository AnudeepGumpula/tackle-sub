"use client";
export function PrintButton({ label }: { label: string }) {
  return <button className="btn-secondary w-full" onClick={() => window.print()}>{label}</button>;
}
