"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    title: "داشبورد",
    href: "/",
    icon: DashboardIcon,
  },
  {
    title: "مشتریان",
    href: "/clients",
    icon: UsersIcon,
  },
  {
    title: "بیمه‌نامه‌ها",
    href: "/policies",
    icon: DocumentIcon,
  },
  {
    title: "بدهکاران",
    href: "/debtors",
    icon: DebtIcon,
  },
  {
    title: "حسابداری",
    href: "/accounting",
    icon: WalletIcon,
  },
];

const accountingNavigation = [
  {
    title: "حسابداری کلی",
    href: "/accounting",
  },
  {
    title: "حساب مشتریان",
    href: "/accounting/clients",
  },
  {
    title: "سررسید گذشته",
    href: "/accounting/overdue",
  },
];

type SidebarProps = {
  collapsed: boolean;
  pinned: boolean;
  mobileOpen: boolean;
  setCollapsed: (value: boolean) => void;
  setPinned: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
};

export default function Sidebar({
  collapsed,
  pinned,
  mobileOpen,
  setCollapsed,
  setPinned,
  setMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const accountingActive = pathname.startsWith("/accounting");

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed right-0 top-0 z-50 h-screen border-l border-gray-200 bg-white",
          "transition-all duration-300",
          "lg:sticky lg:z-30",
          collapsed ? "lg:w-20" : "lg:w-64",
          mobileOpen
            ? "w-72 translate-x-0"
            : "w-72 translate-x-full lg:translate-x-0",
        ].join(" ")}
        dir="rtl"
      >
        <div className="flex h-full flex-col">

          {/* HEADER */}

          <div
            className={[
              "flex h-20 items-center border-b border-gray-200",
              collapsed ? "justify-center px-3" : "justify-between px-5",
            ].join(" ")}
          >
            {!collapsed && (
              <Link href="/" className="min-w-0">
                <div className="text-lg font-bold text-gray-900">
                  مدیریت بیمه
                </div>

                <div className="mt-0.5 text-xs text-gray-500">
                  سامانه مدیریت بیمه‌نامه
                </div>
              </Link>
            )}

            {collapsed && (
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white"
              >
                ب
              </Link>
            )}
          </div>

          {/* NAVIGATION */}

          <nav className="flex-1 overflow-y-auto px-3 py-5">

            {!collapsed && (
              <p className="mb-3 px-3 text-xs font-semibold text-gray-400">
                منوی اصلی
              </p>
            )}

            <div className="space-y-1">

              {navigation.map((item) => {
                const active =
                  item.href === "/accounting"
                    ? accountingActive
                    : isActive(item.href);

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.title : undefined}
                    className={[
                      "group flex items-center rounded-xl transition",
                      collapsed
                        ? "justify-center px-2 py-3"
                        : "gap-3 px-3 py-3",
                      active
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")}
                  >
                    <Icon />

                    {!collapsed && (
                      <span className="text-sm font-medium">
                        {item.title}
                      </span>
                    )}
                  </Link>
                );
              })}

            </div>

            {/* ACCOUNTING SUBMENU */}

            {accountingActive && !collapsed && (
              <div className="mt-5 border-t border-gray-100 pt-5">

                <p className="mb-2 px-3 text-xs font-semibold text-gray-400">
                  بخش حسابداری
                </p>

                <div className="space-y-1">

                  {accountingNavigation.map((item) => {
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={[
                          "block rounded-lg px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        ].join(" ")}
                      >
                        {item.title}
                      </Link>
                    );
                  })}

                </div>
              </div>
            )}

          </nav>

          {/* QUICK ACTIONS */}

          {!collapsed && (
            <div className="border-t border-gray-200 p-4">

              <p className="mb-3 px-2 text-xs font-semibold text-gray-400">
                عملیات سریع
              </p>

              <div className="space-y-2">

                <Link
                  href="/clients/new"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg border border-gray-200 px-3 py-2.5 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  + مشتری جدید
                </Link>

                <Link
                  href="/policies/new"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg bg-black px-3 py-2.5 text-center text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  + بیمه‌نامه جدید
                </Link>

              </div>

            </div>
          )}

          {/* SIDEBAR CONTROLS */}

          <div className="border-t border-gray-200 p-3">

            <div
              className={[
                "flex items-center",
                collapsed ? "justify-center" : "justify-between",
              ].join(" ")}
            >

              {/* Pin */}

              {!collapsed && (
                <button
                  onClick={() => setPinned(!pinned)}
                  className={[
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition",
                    pinned
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50",
                  ].join(" ")}
                  title={pinned ? "باز کردن پین" : "پین کردن منو"}
                >
                  <PinIcon />

                  <span>
                    {pinned ? "پین شده" : "پین نشده"}
                  </span>
                </button>
              )}

              {/* Collapse */}

              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                title={collapsed ? "باز کردن منو" : "جمع کردن منو"}
              >
                <CollapseIcon collapsed={collapsed} />
              </button>

            </div>

          </div>

        </div>
      </aside>
    </>
  );
}


/* =========================================================
   ICONS
   ========================================================= */

function DashboardIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M5 3h14" />
      <path d="M7 3v6l-3 4h16l-3-4V3" />
    </svg>
  );
}

function CollapseIcon({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {collapsed ? (
        <>
          <path d="M9 18l6-6-6-6" />
        </>
      ) : (
        <>
          <path d="M15 18l-6-6 6-6" />
        </>
      )}
    </svg>
  );
}

function DebtIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}