import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMM Studio — social per artisti",
  description:
    "Social media manager automatizzato per artisti e producer musicali italiani.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
