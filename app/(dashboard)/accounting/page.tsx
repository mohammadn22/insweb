import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AccountingClient from "./AccountingClient";

export default async function AccountingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * --------------------------------------------------
   * CLIENTS
   * --------------------------------------------------
   */

  const {
    data: clients,
    error: clientsError,
  } = await supabase
    .from("clients")
    .select("id, full_name, id_number")
    .order("full_name");

  if (clientsError) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h1 className="text-lg font-semibold text-red-800">
              خطا در بارگذاری اطلاعات
            </h1>

            <p className="mt-2 text-sm text-red-700">
              خطا در بارگذاری مشتریان: {clientsError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * TRANSACTIONS
   * --------------------------------------------------
   * Used by the searchable "سابقه پرداخت‌ها" section.
   *
   * transaction_allocations are embedded directly here
   * to avoid large .in(...) requests when there are many
   * payment schedules.
   */

  const {
    data: transactions,
    error: transactionsError,
  } = await supabase
    .from("transactions")
    .select(`
      id,
      client_id,
      policy_id,
      amount,
      payment_date,
      payment_method,
      description,
      clients (
        id,
        full_name,
        id_number
      ),
      policies (
        id,
        policy_number,
        policy_type
      ),
      transaction_allocations (
        id,
        payment_schedule_id,
        amount
      )
    `)
    .order("payment_date", {
      ascending: false,
    });

  if (transactionsError) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h1 className="text-lg font-semibold text-red-800">
              خطا در بارگذاری اطلاعات
            </h1>

            <p className="mt-2 text-sm text-red-700">
              خطا در بارگذاری تراکنش‌ها:{" "}
              {transactionsError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * NORMALIZE TRANSACTIONS
   * --------------------------------------------------
   */

  const normalizedTransactions = (transactions ?? []).map(
    (transaction) => {
      const client = Array.isArray(transaction.clients)
        ? transaction.clients[0]
        : transaction.clients;

      const policy = Array.isArray(transaction.policies)
        ? transaction.policies[0]
        : transaction.policies;

      return {
        id: transaction.id,
        clientId: transaction.client_id,
        policyId: transaction.policy_id,
        amount: Number(transaction.amount ?? 0),
        paymentDate: transaction.payment_date,
        paymentMethod: transaction.payment_method,
        description: transaction.description ?? "",
        clientName: client?.full_name ?? "نامشخص",
        clientIdNumber: client?.id_number ?? "",
        policyNumber: policy?.policy_number ?? "-",
        policyType: policy?.policy_type ?? "-",
      };
    }
  );

  /*
   * --------------------------------------------------
   * NORMALIZE ALLOCATIONS
   * --------------------------------------------------
   */

  const normalizedAllocations = (
    transactions ?? []
  ).flatMap((transaction) => {
    const allocations = Array.isArray(
      transaction.transaction_allocations
    )
      ? transaction.transaction_allocations
      : transaction.transaction_allocations
        ? [transaction.transaction_allocations]
        : [];

    return allocations.map((allocation) => ({
      id: allocation.id,
      transactionId: transaction.id,
      paymentScheduleId: allocation.payment_schedule_id,
      amount: Number(allocation.amount ?? 0),
    }));
  });

  /*
   * --------------------------------------------------
   * ACCOUNTING PAGE
   * --------------------------------------------------
   *
   * Only the searchable payment history is needed.
   * The old:
   *   - all-payments section
   *   - accounting summary section
   *   - policies list
   *   - payment schedules list
   *
   * are no longer loaded here.
   */

  return (
    <AccountingClient
      clients={clients ?? []}
      policies={[]}
      schedules={[]}
      transactions={normalizedTransactions}
      allocations={normalizedAllocations}
    />
  );
}