"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import EditPaymentForm from "./EditPaymentForm";
import { createClient } from "@/lib/supabase/client";
import ExportDebtsButton from "./ExportDebtsButton";

type Client = {
  id: string;
  full_name: string;
  id_number: string;
};

type Policy = {
  id: string;
  policyNumber: string;
  policyType: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  clientId: string;
  clientName: string;
  clientIdNumber: string;
};

type Schedule = {
  id: string;
  policyId: string;
  sequenceNumber: number;
  description: string;
  amountDue: number;
  dueDate: string;
  policyNumber: string;
  policyType: string;
  clientId: string;
  clientName: string;
  clientIdNumber: string;
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

type Allocation = {
  id: string;
  transactionId: string;
  paymentScheduleId: string;
  amount: number;
};

type Props = {
  clients: Client[];
  policies: Policy[];
  schedules: Schedule[];
  transactions: Transaction[];
  allocations: Allocation[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const newYear = date.getFullYear();
  const newMonth = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const newDay = String(date.getDate()).padStart(
    2,
    "0"
  );

  return `${newYear}-${newMonth}-${newDay}`;
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
  policies,
  schedules,
  transactions,
  allocations,
}: Props) {
  const today = getToday();

  const [search, setSearch] = useState("");

  const [debtorFilter, setDebtorFilter] = useState<
    "all" | "overdue" | "upcoming"
  >("all");

  const [scheduleFilter, setScheduleFilter] = useState<
    "all" | "overdue" | "today" | "next7" | "next30"
  >("all");

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
   * PAID AMOUNT BY PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const paidBySchedule = useMemo(() => {
    const map = new Map<string, number>();

    for (const allocation of allocations) {
      const current =
        map.get(allocation.paymentScheduleId) ?? 0;

      map.set(
        allocation.paymentScheduleId,
        current + Number(allocation.amount || 0)
      );
    }

    return map;
  }, [allocations]);

  /*
   * --------------------------------------------------
   * SUMMARY
   * --------------------------------------------------
   */

  const totalPolicyValue = useMemo(() => {
    return policies.reduce(
      (sum, policy) => sum + policy.totalPrice,
      0
    );
  }, [policies]);

  const totalCollected = useMemo(() => {
    return transactions.reduce(
      (sum, transaction) =>
        sum + transaction.amount,
      0
    );
  }, [transactions]);

  const totalOutstanding = useMemo(() => {
    return schedules.reduce((sum, schedule) => {
      const paid =
        paidBySchedule.get(schedule.id) ?? 0;

      return (
        sum +
        Math.max(
          schedule.amountDue - paid,
          0
        )
      );
    }, 0);
  }, [schedules, paidBySchedule]);

  const overdueAmount = useMemo(() => {
    return schedules.reduce((sum, schedule) => {
      if (schedule.dueDate >= today) {
        return sum;
      }

      const paid =
        paidBySchedule.get(schedule.id) ?? 0;

      return (
        sum +
        Math.max(
          schedule.amountDue - paid,
          0
        )
      );
    }, 0);
  }, [schedules, paidBySchedule, today]);

  const monthStart = useMemo(() => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}-01`;
  }, []);

  const monthlyReceipts = useMemo(() => {
    return transactions.reduce(
      (sum, transaction) => {
        if (
          transaction.paymentDate >=
            monthStart &&
          transaction.paymentDate <= today
        ) {
          return sum + transaction.amount;
        }

        return sum;
      },
      0
    );
  }, [
    transactions,
    monthStart,
    today,
  ]);

  /*
   * --------------------------------------------------
   * DEBTORS
   * --------------------------------------------------
   */

  const debtors = useMemo(() => {
    const map = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientIdNumber: string;
        totalDue: number;
        totalPaid: number;
        remaining: number;
        overdue: number;
        policies: Set<string>;
      }
    >();

    for (const schedule of schedules) {
      const paid =
        paidBySchedule.get(schedule.id) ?? 0;

      const remaining = Math.max(
        schedule.amountDue - paid,
        0
      );

      if (remaining <= 0) {
        continue;
      }

      const existing =
        map.get(schedule.clientId);

      const overdue =
        schedule.dueDate < today
          ? remaining
          : 0;

      if (existing) {
        existing.totalDue +=
          schedule.amountDue;

        existing.totalPaid += paid;

        existing.remaining += remaining;

        existing.overdue += overdue;

        existing.policies.add(
          schedule.policyId
        );
      } else {
        map.set(schedule.clientId, {
          clientId: schedule.clientId,
          clientName:
            schedule.clientName,
          clientIdNumber:
            schedule.clientIdNumber,
          totalDue:
            schedule.amountDue,
          totalPaid: paid,
          remaining,
          overdue,
          policies: new Set([
            schedule.policyId,
          ]),
        });
      }
    }

    return Array.from(map.values())
      .map((debtor) => ({
        ...debtor,
        policyCount:
          debtor.policies.size,
      }))
      .sort(
        (a, b) =>
          b.remaining - a.remaining
      );
  }, [
    schedules,
    paidBySchedule,
    today,
  ]);

  const filteredDebtors = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return debtors.filter((debtor) => {
      const matchesSearch =
        !query ||
        debtor.clientName
          .toLowerCase()
          .includes(query) ||
        debtor.clientIdNumber
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (
        debtorFilter === "overdue" &&
        debtor.overdue <= 0
      ) {
        return false;
      }

      if (
        debtorFilter === "upcoming" &&
        debtor.overdue > 0
      ) {
        return false;
      }

      return true;
    });
  }, [
    debtors,
    search,
    debtorFilter,
  ]);

  /*
   * --------------------------------------------------
   * OUTSTANDING PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const outstandingSchedules =
    useMemo(() => {
      return schedules
        .map((schedule) => {
          const paid =
            paidBySchedule.get(
              schedule.id
            ) ?? 0;

          const remaining =
            Math.max(
              schedule.amountDue -
                paid,
              0
            );

          return {
            ...schedule,
            paid,
            remaining,
          };
        })
        .filter(
          (schedule) =>
            schedule.remaining > 0
        );
    }, [
      schedules,
      paidBySchedule,
    ]);

  const filteredSchedules =
    useMemo(() => {
      const next7 = addDays(
        today,
        7
      );

      const next30 = addDays(
        today,
        30
      );

      return outstandingSchedules.filter(
        (schedule) => {
          switch (scheduleFilter) {
            case "overdue":
              return (
                schedule.dueDate <
                today
              );

            case "today":
              return (
                schedule.dueDate ===
                today
              );

            case "next7":
              return (
                schedule.dueDate >=
                  today &&
                schedule.dueDate <=
                  next7
              );

            case "next30":
              return (
                schedule.dueDate >=
                  today &&
                schedule.dueDate <=
                  next30
              );

            default:
              return true;
          }
        }
      );
    }, [
      outstandingSchedules,
      scheduleFilter,
      today,
    ]);

  /*
   * --------------------------------------------------
   * CLIENT SUGGESTIONS
   * --------------------------------------------------
   */

  const filteredClientSuggestions =
    useMemo(() => {
      const query =
        transactionClientFilter
          .trim()
          .toLowerCase();

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
   * TRANSACTIONS
   * --------------------------------------------------
   */

  const filteredTransactions =
    useMemo(() => {
      const query =
        transactionSearch
          .trim()
          .toLowerCase();

      return transactions.filter(
        (transaction) => {
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
            transaction.paymentDate <
              transactionDateFrom
          ) {
            return false;
          }

          if (
            transactionDateTo &&
            transaction.paymentDate >
              transactionDateTo
          ) {
            return false;
          }

          const clientQuery =
            transactionClientFilter
              .trim()
              .toLowerCase();

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
            transactionPolicyFilter
              .trim()
              .toLowerCase();

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
        }
      );
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
                مدیریت مطالبات، بدهی‌ها،
                پرداخت‌ها و مبالغ باقی‌مانده
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <ExportDebtsButton />

              <Link
                href="/policies"
                className="inline-flex items-center justify-center rounded-lg bg-[#0066CC] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#0057AD] hover:shadow-md"
              >
                مشاهده بیمه‌نامه‌ها
              </Link>
            </div>
          </div>
        </header>

        {/* FINANCIAL SUMMARY */}

        <section
          aria-label="خلاصه مالی"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {/* Total policy value */}

          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  ارزش کل بیمه‌نامه‌ها
                </p>

                <p className="mt-3 text-2xl font-bold text-[#1A1A1A]">
                  {formatMoney(
                    totalPolicyValue
                  )}
                </p>

                <p className="mt-1 text-xs text-[#888888]">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-[#0066CC]">
                ◈
              </div>
            </div>
          </div>

          {/* Collected */}

          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  مجموع دریافتی
                </p>

                <p className="mt-3 text-2xl font-bold text-[#1A1A1A]">
                  {formatMoney(
                    totalCollected
                  )}
                </p>

                <p className="mt-1 text-xs text-[#888888]">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg text-emerald-600">
                ✓
              </div>
            </div>
          </div>

          {/* Outstanding */}

          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  بدهی باقی‌مانده
                </p>

                <p className="mt-3 text-2xl font-bold text-[#1A1A1A]">
                  {formatMoney(
                    totalOutstanding
                  )}
                </p>

                <p className="mt-1 text-xs text-[#888888]">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-lg text-amber-600">
                !
              </div>
            </div>
          </div>

          {/* Overdue */}

          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  بدهی معوق
                </p>

                <p className="mt-3 text-2xl font-bold text-red-600">
                  {formatMoney(
                    overdueAmount
                  )}
                </p>

                <p className="mt-1 text-xs text-[#888888]">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-lg text-red-600">
                !
              </div>
            </div>
          </div>

          {/* Monthly */}

          <div className="rounded-xl border border-[#E0E0E0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  دریافتی این ماه
                </p>

                <p className="mt-3 text-2xl font-bold text-[#1A1A1A]">
                  {formatMoney(
                    monthlyReceipts
                  )}
                </p>

                <p className="mt-1 text-xs text-[#888888]">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-lg text-violet-600">
                ↗
              </div>
            </div>
          </div>
        </section>

        {/* DEBTORS */}

        <section className="mt-8 overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-sm">

          <div className="border-b border-[#E0E0E0] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">
                  تمام بدهکاران
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#666666]">
                  مشتریانی که در حال حاضر
                  بدهی باقی‌مانده دارند.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                <div className="relative">
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#888888]">
                    🔍
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="جست‌وجوی نام یا کد ملی"
                    className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-[#F9F9F9] py-2 pr-10 pl-4 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066CC] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-72"
                  />
                </div>

                <select
                  value={debtorFilter}
                  onChange={(e) =>
                    setDebtorFilter(
                      e.target.value as
                        | "all"
                        | "overdue"
                        | "upcoming"
                    )
                  }
                  className="h-11 rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="all">
                    همه بدهکاران
                  </option>

                  <option value="overdue">
                    دارای بدهی معوق
                  </option>

                  <option value="upcoming">
                    بدون بدهی معوق
                  </option>
                </select>
              </div>
            </div>
          </div>

          {filteredDebtors.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <p className="mt-3 font-semibold text-[#1A1A1A]">
                بدهکاری پیدا نشد
              </p>

              <p className="mt-1 text-sm text-[#666666]">
                در حال حاضر مشتری بدهکار
                مطابق فیلتر انتخاب‌شده وجود ندارد.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-right">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#F5F5F5] text-sm text-[#333333]">
                    <th className="px-4 py-4 font-bold">
                      مشتری
                    </th>

                    <th className="px-4 py-4 font-bold">
                      بیمه‌نامه‌ها
                    </th>

                    <th className="px-4 py-4 font-bold">
                      مجموع بدهی
                    </th>

                    <th className="px-4 py-4 font-bold">
                      پرداخت‌شده
                    </th>

                    <th className="px-4 py-4 font-bold">
                      باقی‌مانده
                    </th>

                    <th className="px-4 py-4 font-bold">
                      معوق
                    </th>

                    <th className="px-4 py-4 font-bold">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDebtors.map(
                    (debtor, index) => (
                      <tr
                        key={
                          debtor.clientId
                        }
                        className={`border-b border-[#E0E0E0] transition hover:bg-[#F0F0F0] ${
                          index % 2 === 1
                            ? "bg-[#FAFAFA]"
                            : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#1A1A1A]">
                            {
                              debtor.clientName
                            }
                          </div>

                          <div className="mt-1 text-xs text-[#666666]">
                            {
                              debtor.clientIdNumber
                            }
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0066CC]">
                            {
                              debtor.policyCount
                            }{" "}
                            بیمه‌نامه
                          </span>
                        </td>

                        <td className="px-4 py-4 font-medium text-[#333333]">
                          {formatMoney(
                            debtor.totalDue
                          )}
                        </td>

                        <td className="px-4 py-4 text-[#555555]">
                          {formatMoney(
                            debtor.totalPaid
                          )}
                        </td>

                        <td className="px-4 py-4 font-bold text-[#1A1A1A]">
                          {formatMoney(
                            debtor.remaining
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {debtor.overdue >
                          0 ? (
                            <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                              {formatMoney(
                                debtor.overdue
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              بدون معوق
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/clients/${debtor.clientId}`}
                            className="inline-flex rounded-lg border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-medium text-[#0066CC] transition hover:border-[#0066CC] hover:bg-blue-50"
                          >
                            مشاهده مشتری
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* OUTSTANDING PAYMENTS */}

        <section className="mt-8 overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-sm">

          <div className="border-b border-[#E0E0E0] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">
                  پرداخت‌های باقی‌مانده
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#666666]">
                  مبالغی که هنوز باید از
                  مشتریان دریافت شوند.
                </p>
              </div>

              <select
                value={scheduleFilter}
                onChange={(e) =>
                  setScheduleFilter(
                    e.target.value as
                      | "all"
                      | "overdue"
                      | "today"
                      | "next7"
                      | "next30"
                  )
                }
                className="h-11 rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">
                  همه مبالغ باقی‌مانده
                </option>

                <option value="overdue">
                  معوق
                </option>

                <option value="today">
                  سررسید امروز
                </option>

                <option value="next7">
                  ۷ روز آینده
                </option>

                <option value="next30">
                  ۳۰ روز آینده
                </option>
              </select>
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <p className="mt-3 font-semibold text-[#1A1A1A]">
                پرداخت باقی‌مانده‌ای پیدا نشد
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-right">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#F5F5F5] text-sm text-[#333333]">
                    <th className="px-4 py-4 font-bold">
                      مشتری
                    </th>

                    <th className="px-4 py-4 font-bold">
                      بیمه‌نامه
                    </th>

                    <th className="px-4 py-4 font-bold">
                      پرداخت
                    </th>

                    <th className="px-4 py-4 font-bold">
                      سررسید
                    </th>

                    <th className="px-4 py-4 font-bold">
                      مبلغ
                    </th>

                    <th className="px-4 py-4 font-bold">
                      پرداخت‌شده
                    </th>

                    <th className="px-4 py-4 font-bold">
                      باقی‌مانده
                    </th>

                    <th className="px-4 py-4 font-bold">
                      وضعیت
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSchedules.map(
                    (schedule, index) => {
                      const overdue =
                        schedule.dueDate <
                        today;

                      const dueToday =
                        schedule.dueDate ===
                        today;

                      return (
                        <tr
                          key={
                            schedule.id
                          }
                          className={`border-b border-[#E0E0E0] transition hover:bg-[#F0F0F0] ${
                            index % 2 === 1
                              ? "bg-[#FAFAFA]"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold text-[#1A1A1A]">
                              {
                                schedule.clientName
                              }
                            </div>

                            <div className="mt-1 text-xs text-[#666666]">
                              {
                                schedule.clientIdNumber
                              }
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <Link
                              href={`/policies/${schedule.policyId}`}
                              className="font-semibold text-[#0066CC] hover:underline"
                            >
                              {
                                schedule.policyNumber
                              }
                            </Link>

                            <div className="mt-1 text-xs text-[#666666]">
                              {
                                schedule.policyType
                              }
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm text-[#555555]">
                            {
                              schedule.description
                            }
                          </td>

                          <td className="px-4 py-4 font-medium text-[#333333]">
                            {formatDate(
                              schedule.dueDate
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {formatMoney(
                              schedule.amountDue
                            )}
                          </td>

                          <td className="px-4 py-4 text-[#555555]">
                            {formatMoney(
                              schedule.paid
                            )}
                          </td>

                          <td className="px-4 py-4 font-bold text-[#1A1A1A]">
                            {formatMoney(
                              schedule.remaining
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {overdue ? (
                              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                معوق
                              </span>
                            ) : dueToday ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                سررسید امروز
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0066CC]">
                                سررسید نشده
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* TRANSACTIONS */}

        <section className="mt-8 overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-sm">

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
                    value={
                      transactionSearch
                    }
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  از تاریخ
                </label>

                <input
                  type="date"
                  value={
                    transactionDateFrom
                  }
                  onChange={(e) =>
                    setTransactionDateFrom(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  تا تاریخ
                </label>

                <input
                  type="date"
                  value={
                    transactionDateTo
                  }
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
                  value={
                    transactionClientFilter
                  }
                  onChange={(e) => {
                    setTransactionClientFilter(
                      e.target.value
                    );

                    setClientSuggestionsOpen(
                      true
                    );
                  }}
                  onFocus={() => {
                    if (
                      transactionClientFilter.trim()
                    ) {
                      setClientSuggestionsOpen(
                        true
                      );
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
                              {
                                client.full_name
                              }
                            </div>

                            <div className="mt-1 text-xs text-[#666666]">
                              {
                                client.id_number
                              }
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
                  value={
                    transactionPolicyFilter
                  }
                  onChange={(e) =>
                    setTransactionPolicyFilter(
                      e.target.value
                    )
                  }
                  placeholder="شماره یا نوع بیمه‌نامه"
                  className="h-11 w-full rounded-lg border border-[#D0D0D0] bg-white px-4 text-sm outline-none transition focus:border-[#0066CC] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* METHOD */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#333333]">
                  روش پرداخت
                </label>

                <select
                  value={
                    transactionMethodFilter
                  }
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

          {filteredTransactions.length ===
          0 ? (
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
                    (
                      transaction,
                      index
                    ) => (
                      <Fragment
                        key={
                          transaction.id
                        }
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
                            {
                              transaction.description ||
                              "-"
                            }
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">

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

                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed =
                                    window.confirm(
                                      "آیا مطمئن هستید که می‌خواهید این پرداخت را حذف کنید؟"
                                    );

                                  if (
                                    !confirmed
                                  ) {
                                    return;
                                  }

                                  try {
                                    const {
                                      error,
                                    } =
                                      await supabase.rpc(
                                        "delete_payment",
                                        {
                                          p_transaction_id:
                                            transaction.id,
                                        }
                                      );

                                    if (
                                      error
                                    ) {
                                      throw new Error(
                                        error.message
                                      );
                                    }

                                    window.location.reload();
                                  } catch (
                                    error
                                  ) {
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

        {/* ACCOUNTING OVERVIEW */}

        <section className="mt-8 rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            خلاصه حسابداری
          </h2>

          <p className="mt-1 text-sm text-[#666666]">
            نمای کلی از اطلاعات ثبت‌شده در سیستم
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <div className="rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-5">
              <p className="text-sm font-medium text-[#666666]">
                تعداد مشتریان
              </p>

              <p className="mt-2 text-2xl font-bold text-[#1A1A1A]">
                {clients.length}
              </p>
            </div>

            <div className="rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-5">
              <p className="text-sm font-medium text-[#666666]">
                تعداد بیمه‌نامه‌ها
              </p>

              <p className="mt-2 text-2xl font-bold text-[#1A1A1A]">
                {policies.length}
              </p>
            </div>

            <div className="rounded-lg border border-[#E0E0E0] bg-[#FAFAFA] p-5">
              <p className="text-sm font-medium text-[#666666]">
                مشتریان بدهکار
              </p>

              <p className="mt-2 text-2xl font-bold text-[#1A1A1A]">
                {debtors.length}
              </p>
            </div>

          </div>
        </section>

        {/* FOOTER */}

        <footer className="mt-10 border-t border-[#E0E0E0] py-8 text-center text-sm text-[#666666]">
          سیستم مدیریت بیمه
        </footer>

      </div>
    </main>
  );
}