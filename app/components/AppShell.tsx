"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
const [collapsed, setCollapsed] = useState(false);
const [pinned, setPinned] = useState(true);
const [mobileOpen, setMobileOpen] = useState(false);

useEffect(() => {
  const savedCollapsed = localStorage.getItem("sidebar-collapsed");
  const savedPinned = localStorage.getItem("sidebar-pinned");

  if (savedCollapsed !== null) {
    setCollapsed(savedCollapsed === "true");
  }

  if (savedPinned !== null) {
    setPinned(savedPinned === "true");
  }
}, []);

useEffect(() => {
  localStorage.setItem("sidebar-collapsed", String(collapsed));
}, [collapsed]);

useEffect(() => {
  localStorage.setItem("sidebar-pinned", String(pinned));
}, [pinned]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 text-gray-900"
    >
      <div className="flex min-h-screen">

        <Sidebar
          collapsed={collapsed}
          pinned={pinned}
          mobileOpen={mobileOpen}
          setCollapsed={setCollapsed}
          setPinned={setPinned}
          setMobileOpen={setMobileOpen}
        />

        <main className="min-w-0 flex-1">

          {/* Mobile menu button */}
          <div className="sticky top-0 z-30 flex h-16 items-center border-b border-gray-200 bg-white px-4 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label="باز کردن منو"
            >
              <MenuIcon />
            </button>
          </div>

          {children}

        </main>

      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}