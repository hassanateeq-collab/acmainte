import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hamsun Assets — Maintenance Portal",
  description:
    "The single record of every asset: where it is, what it is connected to, when it needs service, and what it has cost.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
