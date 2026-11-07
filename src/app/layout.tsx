import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneLine: invoice in one sentence",
  description: "Type one sentence, send a professional invoice, get paid with PayPal. No subscription.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
