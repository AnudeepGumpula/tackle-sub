export function Logo({ name = "OneLine" }: { name?: string }) {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2563eb" />
        <path d="M9 11h14M9 16h14M9 21h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {name}
    </span>
  );
}
