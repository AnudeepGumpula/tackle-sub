import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-4 font-medium">We couldn&apos;t find that page or invoice.</p>
      <Link href="/" className="btn-secondary mt-6">Go to dashboard</Link>
    </main>
  );
}
