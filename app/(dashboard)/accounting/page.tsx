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
   * POLICIES
   * --------------------------------------------------
   */

  const {
    data: policies,
    error: policiesError,
  } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      start_date,
      end_date,
      total_price,
      client_id,
      clients (
        id,
        full_name,
        id_number
      )
    `)
    .order("end_date", {
      ascending: true,
    });

  if (policiesError) {
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
              خطا در بارگذاری بیمه‌نامه‌ها:{" "}
              {policiesError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const {
    data: schedules,
    error: schedulesError,
  } = await supabase
    .from("payment_schedule")
    .select(`
      id,
      policy_id,
      sequence_number,
      description,
      amount_due,
      due_date,
      policies (
        id,
        policy_number,
        policy_type,
        client_id,
        clients (
          id,
          full_name,
          id_number
        )
      )
    `)
    .order("due_date", {
      ascending: true,
    });

  if (schedulesError) {
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
              خطا در بارگذاری برنامه‌های پرداخت:{" "}
              {schedulesError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * TRANSACTIONS (with embedded allocations)
   * --------------------------------------------------
   * transaction_allocations is embedded directly here instead of
   * fetched separately with `.in("payment_schedule_id", scheduleIds)`.
   * That second query's URL grows with the number of payment_schedule
   * rows and can exceed request URL limits once there are many (e.g.
   * after a large policy import), causing a hard "fetch failed" at
   * the network layer rather than a normal Postgres error.
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
   * NORMALIZE POLICIES
   * --------------------------------------------------
   */

  const normalizedPolicies = (policies ?? []).map(
    (policy) => {
      const client = Array.isArray(policy.clients)
        ? policy.clients[0]
        : policy.clients;

      return {
        id: policy.id,
        policyNumber: policy.policy_number,
        policyType: policy.policy_type,
        startDate: policy.start_date,
        endDate: policy.end_date,
        totalPrice: Number(
          policy.total_price ?? 0
        ),
        clientId: policy.client_id,
        clientName:
          client?.full_name ?? "نامشخص",
        clientIdNumber:
          client?.id_number ?? "",
      };
    }
  );

  /*
   * --------------------------------------------------
   * NORMALIZE PAYMENT SCHEDULES
   * --------------------------------------------------
   */

  const normalizedSchedules = (
    schedules ?? []
  ).map((schedule) => {
    const policy = Array.isArray(
      schedule.policies
    )
      ? schedule.policies[0]
      : schedule.policies;

    const client = policy?.clients
      ? Array.isArray(policy.clients)
        ? policy.clients[0]
        : policy.clients
      : null;

    return {
      id: schedule.id,
      policyId: schedule.policy_id,
      sequenceNumber:
        schedule.sequence_number,
      description: schedule.description,
      amountDue: Number(
        schedule.amount_due ?? 0
      ),
      dueDate: schedule.due_date,
      policyNumber:
        policy?.policy_number ?? "نامشخص",
      policyType:
        policy?.policy_type ?? "نامشخص",
      clientId:
        policy?.client_id ?? "",
      clientName:
        client?.full_name ?? "نامشخص",
      clientIdNumber:
        client?.id_number ?? "",
    };
  });

  /*
   * --------------------------------------------------
   * NORMALIZE TRANSACTIONS
   * --------------------------------------------------
   */

  const normalizedTransactions = (
    transactions ?? []
  ).map((transaction) => {
    const client = Array.isArray(
      transaction.clients
    )
      ? transaction.clients[0]
      : transaction.clients;

    const policy = Array.isArray(
      transaction.policies
    )
      ? transaction.policies[0]
      : transaction.policies;

    return {
      id: transaction.id,
      clientId: transaction.client_id,
      policyId: transaction.policy_id,
      amount: Number(
        transaction.amount ?? 0
      ),
      paymentDate:
        transaction.payment_date,
      paymentMethod:
        transaction.payment_method,
      description:
        transaction.description ?? "",
      clientName:
        client?.full_name ?? "نامشخص",
      clientIdNumber:
        client?.id_number ?? "",
      policyNumber:
        policy?.policy_number ?? "-",
      policyType:
        policy?.policy_type ?? "-",
    };
  });

  /*
   * --------------------------------------------------
   * NORMALIZE ALLOCATIONS (flattened from transactions)
   * --------------------------------------------------
   */

  const normalizedAllocations = (transactions ?? []).flatMap(
    (transaction) => {
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
    }
  );

  return (
    <AccountingClient
      clients={clients ?? []}
      policies={normalizedPolicies}
      schedules={normalizedSchedules}
      transactions={normalizedTransactions}
      allocations={normalizedAllocations}
    />
  );
}