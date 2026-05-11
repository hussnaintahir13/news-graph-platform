import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AI News Relationship Map",
  description: "Interactive graph of people, companies, countries, and narratives extracted from news.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="max-w-7xl mx-auto p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}
