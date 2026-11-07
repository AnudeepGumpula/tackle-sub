import { Nav } from "@/components/Nav";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="no-print mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-400">
        OneLine: invoicing without the $20–60/month subscription.
      </footer>
    </>
  );
}
