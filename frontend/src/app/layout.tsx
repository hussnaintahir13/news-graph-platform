import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "NewroSense — perceptions, context and details about news",
  description: "NewroSense ingests news, extracts entities and typed relationships, and surfaces the perceptions, context, and details under every headline as a live, auditable graph. © Syed Hussnain Tahir Sherazi.",
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
