import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "News Graph — interactive map of news entities and relationships",
  description: "Continuously crawls news, extracts people / companies / countries / events, and lets you explore them as a live graph. © Syed Hussnain Tahir Sherazi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
