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
  return new Intl.NumberFormat("en-US").format(value);
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
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

const [transactionClientFilter, setTransactionClientFilter] =
  useState("");

const [transactionPolicyFilter, setTransactionPolicyFilter] =
  useState("");

const [transactionMethodFilter, setTransactionMethodFilter] =
  useState("");
  
  const [editingTransactionId, setEditingTransactionId] =
  useState<string | null>(null);

const [clientSuggestionsOpen, setClientSuggestionsOpen] =
  useState(false);

  const supabase = createClient();


  /*
   * --------------------------------------------------
   * PAID AMOUNT BY SCHEDULE
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
      (sum, transaction) => sum + transaction.amount,
      0
    );
  }, [transactions]);

  const totalOutstanding = useMemo(() => {
    return schedules.reduce((sum, schedule) => {
      const paid =
        paidBySchedule.get(schedule.id) ?? 0;

      return (
        sum +
        Math.max(schedule.amountDue - paid, 0)
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
        Math.max(schedule.amountDue - paid, 0)
      );
    }, 0);
  }, [schedules, paidBySchedule, today]);

  const monthStart = new Date();

  monthStart.setDate(1);

  const monthStartString = monthStart
    .toISOString()
    .split("T")[0];

  const monthlyReceipts = useMemo(() => {
    return transactions.reduce((sum, transaction) => {
      if (
        transaction.paymentDate >= monthStartString &&
        transaction.paymentDate <= today
      ) {
        return sum + transaction.amount;
      }

      return sum;
    }, 0);
  }, [transactions, monthStartString, today]);

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

      const existing = map.get(schedule.clientId);

      const overdue =
        schedule.dueDate < today
          ? remaining
          : 0;

      if (existing) {
        existing.totalDue += schedule.amountDue;
        existing.totalPaid += paid;
        existing.remaining += remaining;
        existing.overdue += overdue;
        existing.policies.add(schedule.policyId);
      } else {
        map.set(schedule.clientId, {
          clientId: schedule.clientId,
          clientName: schedule.clientName,
          clientIdNumber: schedule.clientIdNumber,
          totalDue: schedule.amountDue,
          totalPaid: paid,
          remaining,
          overdue,
          policies: new Set([schedule.policyId]),
        });
      }
    }

    return Array.from(map.values())
      .map((debtor) => ({
        ...debtor,
        policyCount: debtor.policies.size,
      }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [schedules, paidBySchedule, today]);

  const filteredDebtors = useMemo(() => {
    const query = search.trim().toLowerCase();

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
  }, [debtors, search, debtorFilter]);

  /*
   * --------------------------------------------------
   * OUTSTANDING PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const outstandingSchedules = useMemo(() => {
    return schedules
      .map((schedule) => {
        const paid =
          paidBySchedule.get(schedule.id) ?? 0;

        const remaining = Math.max(
          schedule.amountDue - paid,
          0
        );

        return {
          ...schedule,
          paid,
          remaining,
        };
      })
      .filter((schedule) => schedule.remaining > 0);
  }, [schedules, paidBySchedule]);

  const filteredSchedules = useMemo(() => {
    const next7 = addDays(today, 7);
    const next30 = addDays(today, 30);

    return outstandingSchedules.filter((schedule) => {
      switch (scheduleFilter) {
        case "overdue":
          return schedule.dueDate < today;

        case "today":
          return schedule.dueDate === today;

        case "next7":
          return (
            schedule.dueDate >= today &&
            schedule.dueDate <= next7
          );

        case "next30":
          return (
            schedule.dueDate >= today &&
            schedule.dueDate <= next30
          );

        default:
          return true;
      }
    });
  }, [
    outstandingSchedules,
    scheduleFilter,
    today,
  ]);

  /*
   * --------------------------------------------------
   * TRANSACTIONS
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
}, [clients, transactionClientFilter]); 
  
const filteredTransactions = useMemo(() => {
  const query =
    transactionSearch.trim().toLowerCase();

  return transactions.filter((transaction) => {
    /*
     * SEARCH
     */
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

    /*
     * DATE FROM
     */
    if (
      transactionDateFrom &&
      transaction.paymentDate < transactionDateFrom
    ) {
      return false;
    }

    /*
     * DATE TO
     */
    if (
      transactionDateTo &&
      transaction.paymentDate > transactionDateTo
    ) {
      return false;
    }

/*
 * CLIENT
 */
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

/*
 * POLICY
 */
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

    /*
     * PAYMENT METHOD
     */
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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm underline"
            >
              ← Dashboard
            </Link>

            <div className="flex items-center justify-between">
  <h1 className="text-3xl font-bold">
    Accounting
  </h1>

  <ExportDebtsButton />
</div>

            <p className="mt-2 text-gray-600">
              Track receivables, debts, payments and
              outstanding balances.
            </p>
          </div>

          <Link
            href="/policies"
            className="rounded-md bg-black px-5 py-2 text-center text-white hover:bg-gray-800"
          >
            View Policies
          </Link>
        </div>

        {/* SUMMARY */}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Policy Value
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalPolicyValue)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Collected
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalCollected)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Outstanding
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalOutstanding)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Overdue
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(overdueAmount)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              This Month
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(monthlyReceipts)}
            </p>
          </div>

        </section>

        {/* ALL DEBTORS */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>
              <h2 className="text-xl font-semibold">
                All Debtors
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Every client with an outstanding balance.
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search name or ID..."
                className="rounded-md border px-3 py-2"
              />

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
                className="rounded-md border px-3 py-2"
              >
                <option value="all">
                  All Debtors
                </option>

                <option value="overdue">
                  Has Overdue Debt
                </option>

                <option value="upcoming">
                  No Overdue Debt
                </option>
              </select>

            </div>

          </div>

          {filteredDebtors.length === 0 ? (
            <p className="mt-6 text-gray-500">
              No debtors found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">
                      Client
                    </th>

                    <th className="p-3">
                      Policies
                    </th>

                    <th className="p-3">
                      Total Due
                    </th>

                    <th className="p-3">
                      Paid
                    </th>

                    <th className="p-3">
                      Remaining
                    </th>

                    <th className="p-3">
                      Overdue
                    </th>

                    <th className="p-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDebtors.map((debtor) => (
                    <tr
                      key={debtor.clientId}
                      className="border-b"
                    >
                      <td className="p-3">
                        <div className="font-medium">
                          {debtor.clientName}
                        </div>

                        <div className="text-sm text-gray-500">
                          {debtor.clientIdNumber}
                        </div>
                      </td>

                      <td className="p-3">
                        {debtor.policyCount}
                      </td>

                      <td className="p-3">
                        {formatMoney(
                          debtor.totalDue
                        )}
                      </td>

                      <td className="p-3">
                        {formatMoney(
                          debtor.totalPaid
                        )}
                      </td>

                      <td className="p-3 font-semibold">
                        {formatMoney(
                          debtor.remaining
                        )}
                      </td>

                      <td className="p-3">
                        {formatMoney(
                          debtor.overdue
                        )}
                      </td>

                      <td className="p-3">
                        <Link
                          href={`/clients/${debtor.clientId}`}
                          className="text-sm underline"
                        >
                          View Client
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* OUTSTANDING PAYMENTS */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>
              <h2 className="text-xl font-semibold">
                Outstanding Payments
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Money that is still expected from clients.
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
              className="rounded-md border px-3 py-2"
            >
              <option value="all">
                All Outstanding
              </option>

              <option value="overdue">
                Overdue
              </option>

              <option value="today">
                Due Today
              </option>

              <option value="next7">
                Next 7 Days
              </option>

              <option value="next30">
                Next 30 Days
              </option>
            </select>

          </div>

          {filteredSchedules.length === 0 ? (
            <p className="mt-6 text-gray-500">
              No outstanding payments found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">
                      Client
                    </th>

                    <th className="p-3">
                      Policy
                    </th>

                    <th className="p-3">
                      Payment
                    </th>

                    <th className="p-3">
                      Due Date
                    </th>

                    <th className="p-3">
                      Amount
                    </th>

                    <th className="p-3">
                      Paid
                    </th>

                    <th className="p-3">
                      Remaining
                    </th>

                    <th className="p-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSchedules.map(
                    (schedule) => {
                      const overdue =
                        schedule.dueDate < today;

                      const dueToday =
                        schedule.dueDate === today;

                      return (
                        <tr
                          key={schedule.id}
                          className="border-b"
                        >

                          <td className="p-3">
                            <div className="font-medium">
                              {schedule.clientName}
                            </div>

                            <div className="text-sm text-gray-500">
                              {schedule.clientIdNumber}
                            </div>
                          </td>

                          <td className="p-3">
                            <Link
                              href={`/policies/${schedule.policyId}`}
                              className="underline"
                            >
                              {schedule.policyNumber}
                            </Link>

                            <div className="text-sm text-gray-500">
                              {schedule.policyType}
                            </div>
                          </td>

                          <td className="p-3">
                            {schedule.description}
                          </td>

                          <td className="p-3">
                            {schedule.dueDate}
                          </td>

                          <td className="p-3">
                            {formatMoney(
                              schedule.amountDue
                            )}
                          </td>

                          <td className="p-3">
                            {formatMoney(
                              schedule.paid
                            )}
                          </td>

                          <td className="p-3 font-semibold">
                            {formatMoney(
                              schedule.remaining
                            )}
                          </td>

                          <td className="p-3">

                            {overdue ? (
                              <span className="font-medium text-red-600">
                                Overdue
                              </span>
                            ) : dueToday ? (
                              <span className="font-medium">
                                Due Today
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                Due
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

        <section className="mt-8 rounded-lg border bg-white p-6">

<div>
  <h2 className="text-xl font-semibold">
    Payment History
  </h2>

  <p className="mt-1 text-sm text-gray-500">
    Complete record of received payments.
  </p>
</div>

<div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">

  {/* SEARCH */}

  <input
    type="text"
    value={transactionSearch}
    onChange={(e) =>
      setTransactionSearch(e.target.value)
    }
    placeholder="Search payments..."
    className="rounded-md border px-3 py-2"
  />

  {/* DATE FROM */}

  <input
    type="date"
    value={transactionDateFrom}
    onChange={(e) =>
      setTransactionDateFrom(e.target.value)
    }
    className="rounded-md border px-3 py-2"
    aria-label="From date"
  />

  {/* DATE TO */}

  <input
    type="date"
    value={transactionDateTo}
    onChange={(e) =>
      setTransactionDateTo(e.target.value)
    }
    className="rounded-md border px-3 py-2"
    aria-label="To date"
  />

  {/* CLIENT */}

<div className="relative">
<div className="relative">
  <input
    type="text"
    value={transactionClientFilter}
    onChange={(e) => {
      setTransactionClientFilter(e.target.value);
      setClientSuggestionsOpen(true);
    }}
    onFocus={() => {
      if (transactionClientFilter.trim()) {
        setClientSuggestionsOpen(true);
      }
    }}
    placeholder="Search client by name or ID..."
    className="w-full rounded-md border px-3 py-2"
  />

  {clientSuggestionsOpen &&
    filteredClientSuggestions.length > 0 && (
      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
        {filteredClientSuggestions.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => {
              setTransactionClientFilter(
                client.full_name
              );
              setClientSuggestionsOpen(false);
            }}
            className="block w-full px-3 py-2 text-left hover:bg-gray-50"
          >
            <div className="font-medium">
              {client.full_name}
            </div>

            <div className="text-sm text-gray-500">
              {client.id_number}
            </div>
          </button>
        ))}
      </div>
    )}
</div>

  {clientSuggestionsOpen &&
    filteredClientSuggestions.length > 0 && (
      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
        {filteredClientSuggestions.map((client) => (
          <button
            key={client.id}
            type="button"
            onClick={() => {
              setTransactionClientFilter(
                client.full_name
              );
              setClientSuggestionsOpen(false);
            }}
            className="block w-full px-3 py-2 text-left hover:bg-gray-50"
          >
            <div className="font-medium">
              {client.full_name}
            </div>

            <div className="text-sm text-gray-500">
              {client.id_number}
            </div>
          </button>
        ))}
      </div>
    )}
</div>

  {/* POLICY */}

<input
  type="text"
  value={transactionPolicyFilter}
  onChange={(e) =>
    setTransactionPolicyFilter(e.target.value)
  }
  placeholder="Search policy number or type..."
  className="rounded-md border px-3 py-2"
/>

  {/* PAYMENT METHOD */}

  <select
    value={transactionMethodFilter}
    onChange={(e) =>
      setTransactionMethodFilter(e.target.value)
    }
    className="rounded-md border px-3 py-2"
  >
    <option value="">
      All Payment Methods
    </option>

    <option value="cash">
      Cash
    </option>

    <option value="card">
      Card
    </option>

    <option value="bank_transfer">
      Bank Transfer
    </option>

    <option value="other">
      Other
    </option>
  </select>

</div>

{/* CLEAR FILTERS */}

<div className="mt-3 flex justify-end">
  <button
    type="button"
    onClick={() => {
      setTransactionSearch("");
      setTransactionDateFrom("");
      setTransactionDateTo("");
      setTransactionClientFilter("");
      setTransactionPolicyFilter("");
      setTransactionMethodFilter("");
    }}
    className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
  >
    Clear Filters
  </button>
</div>

          {filteredTransactions.length === 0 ? (
            <p className="mt-6 text-gray-500">
              No transactions found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-3">
                      Date
                    </th>

                    <th className="p-3">
                      Client
                    </th>

                    <th className="p-3">
                      Policy
                    </th>

                    <th className="p-3">
                      Amount
                    </th>

                    <th className="p-3">
                      Method
                    </th>

                    <th className="p-3">
                      Description
                    </th>

                    <th className="p-3">
  Action
</th>

                  </tr>
                </thead>

                <tbody>

{filteredTransactions.map((transaction) => (
  <Fragment key={transaction.id}>
    <tr className="border-b">

      <td className="p-3">
        {transaction.paymentDate}
      </td>

      <td className="p-3">
        <div className="font-medium">
          {transaction.clientName}
        </div>

        <div className="text-sm text-gray-500">
          {transaction.clientIdNumber}
        </div>
      </td>

      <td className="p-3">
        {transaction.policyId ? (
          <Link
            href={`/policies/${transaction.policyId}`}
            className="underline"
          >
            {transaction.policyNumber}
          </Link>
        ) : (
          "-"
        )}
      </td>

      <td className="p-3 font-semibold">
        {formatMoney(transaction.amount)}
      </td>

      <td className="p-3">
        {transaction.paymentMethod}
      </td>

      <td className="p-3">
        {transaction.description || "-"}
      </td>

<td className="p-3">
  <div className="flex gap-3">

    <button
      type="button"
      onClick={() => {
        setEditingTransactionId(
          editingTransactionId === transaction.id
            ? null
            : transaction.id
        );
      }}
      className="cursor-pointer text-sm text-blue-600 underline"
    >
      {editingTransactionId === transaction.id
        ? "Close"
        : "Edit"}
    </button>

    <button
      type="button"
      onClick={async () => {
        const confirmed = window.confirm(
          "Are you sure you want to delete this payment?"
        );

        if (!confirmed) {
          return;
        }

        try {
          const { error } = await supabase.rpc(
            "delete_payment",
            {
              p_transaction_id: transaction.id,
            }
          );

          if (error) {
            throw new Error(error.message);
          }

          window.location.reload();
        } catch (error) {
          alert(
            error instanceof Error
              ? error.message
              : "Could not delete payment."
          );
        }
      }}
      className="cursor-pointer text-sm text-red-600 underline"
    >
      Delete
    </button>

  </div>
</td>

    </tr>

    {editingTransactionId === transaction.id && (
      <tr>
        <td
          colSpan={7}
          className="border-b p-4"
        >
          <EditPaymentForm
            transactionId={transaction.id}
            initialAmount={transaction.amount}
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
              setEditingTransactionId(null);
            }}
            onSaved={() => {
              setEditingTransactionId(null);
              window.location.reload();
            }}
          />
        </td>
      </tr>
    )}
  </Fragment>
))}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* FOOTER INFORMATION */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <h2 className="text-lg font-semibold">
            Accounting Overview
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">

            <div>
              <p className="text-sm text-gray-500">
                Total Clients
              </p>

              <p className="mt-1 text-xl font-semibold">
                {clients.length}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Total Policies
              </p>

              <p className="mt-1 text-xl font-semibold">
                {policies.length}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Clients With Debt
              </p>

              <p className="mt-1 text-xl font-semibold">
                {debtors.length}
              </p>
            </div>

          </div>

        </section>

      </div>
    </main>
  );
}