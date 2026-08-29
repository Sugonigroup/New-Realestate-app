import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildOS ERP",
  description: "AI-operated construction ERP — system of record",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
