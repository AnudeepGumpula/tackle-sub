import { Nav } from "@/components/Nav";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
