"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const LINKS: { href: string; label: string; short?: string }[] = [
  { href: "/", label: "Dashboard", short: "Home" },
  { href: "/invoices/new", label: "New invoice", short: "New" },
  { href: "/clients", label: "Clients" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
        <Link href="/" aria-label="OneLine home" className="shrink-0"><span className="sm:hidden"><Logo name="" /></span><span className="hidden sm:inline"><Logo /></span></Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
                aria-current={active ? "page" : undefined}
              >
                {l.short ? (<><span className="sm:hidden">{l.short}</span><span className="hidden sm:inline">{l.label}</span></>) : l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
