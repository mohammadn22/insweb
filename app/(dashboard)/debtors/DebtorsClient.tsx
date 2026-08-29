"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Debtor } from "./page";

type DebtorsClientProps = {
  debtors: Debtor[];
  totalDebt: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export default function DebtorsClient({
  debtors,
  totalDebt,
}: DebtorsClientProps) {
  const [search, setSearch] = useState("");

  const filteredDebtors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return debtors;
    }

    return debtors.filter((debtor) => {
      const nameMatch = debtor.clientName.toLowerCase().includes(query);
      const mobileMatch = (debtor.mobile ?? "").toLowerCase().includes(query);

      return nameMatch || mobileMatch;
    });
  }, [debtors, search]);

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}

        <header className="mb-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              بدهکاران
            </h1>

            <p className="text-base leading-6 text-gray-500">
              مشتریانی که سررسید پرداختشان گذشته و هنوز تسویه نشده‌اند
            </p>
          </div>
        </header>

        {/* SUMMARY CARD */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  مجموع بدهی معوق
                </p>

                <p className="mt-3 text-2xl font-bold tracking-tight text-red-600">
                  {formatMoney(totalDebt)}
                </p>

                <p className="mt-1 text-xs text-gray-400">ریال</p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-lg text-red-600">
                !
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  تعداد مشتریان بدهکار
                </p>

                <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
                  {formatNumber(debtors.length)}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600">
                👤
              </div>
            </div>
          </div>
        </section>

        {/* SEARCH */}

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            جستجوی بدهکار
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو بر اساس نام یا شماره موبایل..."
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </section>

        {/* EMPTY STATE */}

        {debtors.length === 0 && (
          <section className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
              ✓
            </div>

            <h2 className="mt-5 text-lg font-semibold text-gray-900">
              هیچ بدهکاری وجود ندارد
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              در حال حاضر هیچ پرداخت سررسیدگذشته و تسویه‌نشده‌ای ثبت نشده است.
            </p>
          </section>
        )}

        {/* NO SEARCH RESULTS */}

        {debtors.length > 0 && filteredDebtors.length === 0 && (
          <section className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              نتیجه‌ای برای این جست‌وجو پیدا نشد.
            </p>
          </section>
        )}

        {/* TABLE */}

        {filteredDebtors.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      نام مشتری
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      شماره موبایل
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      مجموع بدهی
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredDebtors.map((debtor) => (
                    <tr key={debtor.clientId} className="transition hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {debtor.clientName}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {formatNumber(debtor.overdueInstallments)} قسط معوق
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {debtor.mobile || "-"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-red-600">
                        {formatMoney(debtor.totalDebt)} ریال
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/clients/${debtor.clientId}`}
                          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          مشاهده مشتری
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}