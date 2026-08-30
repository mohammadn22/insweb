"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import EditPaymentForm from "./EditPaymentForm";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
  id_number: string;
};

type Transaction = {
  id: string;
  clientId: string;
  policyId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  description: string;
  clientName: string;
  clientIdNumber: string;
  policyNumber: string;
  policyType: string;
};

type Props = {
  clients: Client[];
  transactions: Transaction[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatDate(dateString: string) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "نقدی";

    case "card":
      return "کارت";

    case "bank_transfer":
      return "انتقال بانکی";

    case "other":
      return "سایر";

    default:
      return method || "نامشخص";
  }
}

function getPaymentMethodStyle(method: string) {
  switch (method) {
    case "cash":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "card":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "bank_transfer":
      return "bg-violet-50 text-violet-700 border-violet-200";

    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function AccountingClient({
  clients,
  transactions,
}: Props) {
  const [transactionSearch, setTransactionSearch] =
    useState("");

  const [transactionDateFrom, setTransactionDateFrom] =
    useState("");

  const [transactionDateTo, setTransactionDateTo] =
    useState("");

  const [
    transactionClientFilter,
    setTransactionClientFilter,
  ] = useState("");

  const [
    transactionPolicyFilter,
    setTransactionPolicyFilter,
  ] = useState("");

  const [
    transactionMethodFilter,
    setTransactionMethodFilter,
  ] = useState("");

  const [editingTransactionId, setEditingTransactionId] =
    useState<string | null>(null);

  const [clientSuggestionsOpen, setClientSuggestionsOpen] =
    useState(false);

  const supabase = createClient();

  /*
   * --------------------------------------------------
   * CLIENT SUGGESTIONS
   * --------------------------------------------------
   */

  const filteredClientSuggestions = useMemo(() => {
    const query =
      transactionClientFilter.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return clients
      .filter((client) => {
        return (
          client.full_name
            .toLowerCase()
            .includes(query) ||
          client.id_number
            .toLowerCase()
            .includes(query)
        );
      })
      .slice(0, 10);
  }, [
    clients,
    transactionClientFilter,
  ]);

  /*
   * --------------------------------------------------
   * FILTERED TRANSACTIONS
   * --------------------------------------------------
   */

  const filteredTransactions = useMemo(() => {
    const query =
      transactionSearch.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !query ||
        transaction.clientName
          .toLowerCase()
          .includes(query) ||
        transaction.clientIdNumber
          .toLowerCase()
          .includes(query) ||
        transaction.policyNumber
          .toLowerCase()
          .includes(query) ||
        transaction.paymentMethod
          .toLowerCase()
          .includes(query) ||
        transaction.description
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (
        transactionDateFrom &&
        transaction.paymentDate < transactionDateFrom
      ) {
        return false;
      }

      if (
        transactionDateTo &&
        transaction.paymentDate > transactionDateTo
      ) {
        return false;
      }

      const clientQuery =
        transactionClientFilter.trim().toLowerCase();

      const matchesClient =
        !clientQuery ||
        transaction.clientName
          .toLowerCase()
          .includes(clientQuery) ||
        transaction.clientIdNumber
          .toLowerCase()
          .includes(clientQuery);

      if (!matchesClient) {
        return false;
      }

      const policyQuery =
        transactionPolicyFilter.trim().toLowerCase();

      const matchesPolicy =
        !policyQuery ||
        transaction.policyNumber
          .toLowerCase()
          .includes(policyQuery) ||
        transaction.policyType
          .toLowerCase()
          .includes(policyQuery);

      if (!matchesPolicy) {
        return false;
      }

      if (
        transactionMethodFilter &&
        transaction.paymentMethod !==
          transactionMethodFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    transactions,
    transactionSearch,
    transactionDateFrom,
    transactionDateTo,
    transactionClientFilter,
    transactionPolicyFilter,
    transactionMethodFilter,
  ]);

  /*
   * --------------------------------------------------
   * RENDER
   * --------------------------------------------------
   */

  return (
    <main
      className="min-h-screen bg-[#F5F7FA]"
      dir="rtl"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">

        {/* HEADER */}

        <header className="mb-8 rounded-xl border border-[#E0E0E0] bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <Link
                href="/"
                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#0066CC] hover:underline"
              >
                ← بازگشت به داشبورد
              </Link>

              <h1 className="text-[2.5rem] font-bold leading-tight text-[#1A1A1A]">
               حسابداری
              </h1>

              <p className="mt-2 max-w-2xl text-base leading-7 text-[#666666]">
                جست‌وجو و مشاهده سوابق کامل پرداخت‌های ثبت‌شده
              </p>
            </div>

          </div>
        </header>

        {/* PAYMENT HISTORY */}

        <section className="overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-sm">

          <div className="border-b border-[#E0E0E0] px-5 py-5 sm:px-6">
            <h2 className="text-2xl font-bold text-[#1A1A1A]">
              سابقه پرداخت‌ها
            </h2>

            <p className="mt-1 text-sm leading-6 text-[#666666]">
              فهرست کامل پرداخت‌های دریافت‌شده.
            </p>
          </div>

          {/* FILTER PANEL */}

          <div className="border-b border-[#E0E0E0] bg-[#FAFAFA] px-5 py-5 sm:px-6">

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

              {/* SEARCH */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  جست‌وجوی پرداخت
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#888888]">
                    🔍
                  </span>

                  <input
                    type="text"
                    value={transactionSearch}
                    onChange={(e) =>
                      setTransactionSearch(
                        e.target.value
                      )
                    }
                    placeholder="نام، بیمه‌نامه یا توضیح..."
                    className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white py-2 pr-10 pl-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* DATE FROM */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  از تاریخ
                </label>

                <input
                  type="date"
                  value={transactionDateFrom}
                  onChange={(e) =>
                    setTransactionDateFrom(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* DATE TO */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  تا تاریخ
                </label>

                <input
                  type="date"
                  value={transactionDateTo}
                  onChange={(e) =>
                    setTransactionDateTo(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* CLIENT */}

              <div className="relative">
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  مشتری
                </label>

                <input
                  type="text"
                  value={transactionClientFilter}
                  onChange={(e) => {
                    setTransactionClientFilter(
                      e.target.value
                    );

                    setClientSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    if (
                      transactionClientFilter.trim()
                    ) {
                      setClientSuggestionsOpen(true);
                    }
                  }}
                  placeholder="نام یا کد ملی"
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />

                {clientSuggestionsOpen &&
                  filteredClientSuggestions.length >
                    0 && (
                    <div className="absolute right-0 top-full z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-[#D0D0D0] bg-white shadow-lg">

                      {filteredClientSuggestions.map(
                        (client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setTransactionClientFilter(
                                client.full_name
                              );

                              setClientSuggestionsOpen(
                                false
                              );
                            }}
                            className="block w-full border-b border-[#EEEEEE] px-4 py-3 text-right transition last:border-b-0 hover:bg-blue-50"
                          >
                            <div className="font-semibold text-[#1A1A1A]">
                              {client.full_name}
                            </div>

                            <div className="mt-1 text-xs text-[#666666]">
                              {client.id_number}
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
              </div>

              {/* POLICY */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  بیمه‌نامه
                </label>

                <input
                  type="text"
                  value={transactionPolicyFilter}
                  onChange={(e) =>
                    setTransactionPolicyFilter(
                      e.target.value
                    )
                  }
                  placeholder="شماره یا نوع بیمه‌نامه"
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* PAYMENT METHOD */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  روش پرداخت
                </label>

                <select
                  value={transactionMethodFilter}
                  onChange={(e) =>
                    setTransactionMethodFilter(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    همه روش‌های پرداخت
                  </option>

                  <option value="cash">
                    نقدی
                  </option>

                  <option value="card">
                    کارت
                  </option>

                  <option value="bank_transfer">
                    انتقال بانکی
                  </option>

                  <option value="other">
                    سایر
                  </option>
                </select>
              </div>
            </div>

            {/* CLEAR FILTERS */}

            <div className="mt-4 flex justify-start">
              <button
                type="button"
                onClick={() => {
                  setTransactionSearch("");
                  setTransactionDateFrom("");
                  setTransactionDateTo("");
                  setTransactionClientFilter("");
                  setTransactionPolicyFilter("");
                  setTransactionMethodFilter("");
                  setClientSuggestionsOpen(false);
                }}
                className="rounded-lg border border-[#D0D0D0] bg-white px-4 py-2.5 text-sm font-medium text-[#555555] transition hover:border-[#0066CC] hover:bg-blue-50 hover:text-[#0066CC]"
              >
                پاک کردن فیلترها
              </button>
            </div>
          </div>

          {/* TRANSACTION TABLE */}

          {filteredTransactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                —
              </div>

              <p className="mt-3 font-semibold text-[#1A1A1A]">
                تراکنشی پیدا نشد
              </p>

              <p className="mt-1 text-sm text-[#666666]">
                فیلترهای انتخاب‌شده هیچ پرداختی
                را نمایش نمی‌دهند.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-right">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#F5F5F5] text-sm text-[#333333]">
                    <th className="px-4 py-4 font-bold">
                      تاریخ
                    </th>

                    <th className="px-4 py-4 font-bold">
                      مشتری
                    </th>

                    <th className="px-4 py-4 font-bold">
                      بیمه‌نامه
                    </th>

                    <th className="px-4 py-4 font-bold">
                      مبلغ
                    </th>

                    <th className="px-4 py-4 font-bold">
                      روش پرداخت
                    </th>

                    <th className="px-4 py-4 font-bold">
                      توضیح
                    </th>

                    <th className="px-4 py-4 font-bold">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map(
                    (transaction, index) => (
                      <Fragment
                        key={transaction.id}
                      >
                        <tr
                          className={`border-b border-[#E0E0E0] transition hover:bg-[#F0F0F0] ${
                            index % 2 === 1
                              ? "bg-[#FAFAFA]"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-4 font-medium text-[#333333]">
                            {formatDate(
                              transaction.paymentDate
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-[#1A1A1A]">
                              {
                                transaction.clientName
                              }
                            </div>

                            <div className="mt-1 text-xs text-[#666666]">
                              {
                                transaction.clientIdNumber
                              }
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            {transaction.policyId ? (
                              <Link
                                href={`/policies/${transaction.policyId}`}
                                className="font-semibold text-[#0066CC] hover:underline"
                              >
                                {
                                  transaction.policyNumber
                                }
                              </Link>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className="px-4 py-4 font-bold text-[#1A1A1A]">
                            {formatMoney(
                              transaction.amount
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentMethodStyle(
                                transaction.paymentMethod
                              )}`}
                            >
                              {formatPaymentMethod(
                                transaction.paymentMethod
                              )}
                            </span>
                          </td>

                          <td className="max-w-xs px-4 py-4 text-sm text-[#555555]">
                            {transaction.description ||
                              "-"}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">

                              {/* EDIT */}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTransactionId(
                                    editingTransactionId ===
                                      transaction.id
                                      ? null
                                      : transaction.id
                                  );
                                }}
                                className="rounded-lg border border-[#D0D0D0] bg-white px-3 py-2 text-sm font-medium text-[#0066CC] transition hover:border-[#0066CC] hover:bg-blue-50"
                              >
                                {editingTransactionId ===
                                transaction.id
                                  ? "بستن"
                                  : "ویرایش"}
                              </button>

                              {/* DELETE */}

                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed =
                                    window.confirm(
                                      "آیا مطمئن هستید که می‌خواهید این پرداخت را حذف کنید؟"
                                    );

                                  if (!confirmed) {
                                    return;
                                  }

                                  try {
                                    const { error } =
                                      await supabase.rpc(
                                        "delete_payment",
                                        {
                                          p_transaction_id:
                                            transaction.id,
                                        }
                                      );

                                    if (error) {
                                      throw new Error(
                                        error.message
                                      );
                                    }

                                    window.location.reload();
                                  } catch (error) {
                                    alert(
                                      error instanceof
                                        Error
                                        ? error.message
                                        : "حذف پرداخت انجام نشد."
                                    );
                                  }
                                }}
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* EDIT FORM */}

                        {editingTransactionId ===
                          transaction.id && (
                          <tr>
                            <td
                              colSpan={7}
                              className="border-b border-[#E0E0E0] bg-blue-50/30 p-5"
                            >
                              <div className="rounded-xl border border-[#D0D0D0] bg-white p-5 shadow-sm">
                                <EditPaymentForm
                                  transactionId={
                                    transaction.id
                                  }
                                  initialAmount={
                                    transaction.amount
                                  }
                                  initialPaymentDate={
                                    transaction.paymentDate
                                  }
                                  initialPaymentMethod={
                                    transaction.paymentMethod
                                  }
                                  initialDescription={
                                    transaction.description
                                  }
                                  onCancel={() => {
                                    setEditingTransactionId(
                                      null
                                    );
                                  }}
                                  onSaved={() => {
                                    setEditingTransactionId(
                                      null
                                    );

                                    window.location.reload();
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* FOOTER */}

        <footer className="mt-10 border-t border-[#E0E0E0] py-8 text-center text-sm text-[#666666]">
          سیستم مدیریت بیمه
        </footer>

      </div>
    </main>
  );
}