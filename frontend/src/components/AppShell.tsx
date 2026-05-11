"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onMenuClick={() => setOpen(true)} />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
