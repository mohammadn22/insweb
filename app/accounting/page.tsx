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

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, full_name, id_number")
    .order("full_name");

  if (clientsError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-red-600">
            Failed to load clients: {clientsError.message}
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * POLICIES
   * --------------------------------------------------
   */

  const { data: policies, error: policiesError } = await supabase
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
    .order("end_date", { ascending: true });

  if (policiesError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-red-600">
            Failed to load policies: {policiesError.message}
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const { data: schedules, error: schedulesError } = await supabase
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
    .order("due_date", { ascending: true });

  if (schedulesError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-red-600">
            Failed to load payment schedules:{" "}
            {schedulesError.message}
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * TRANSACTIONS
   * --------------------------------------------------
   */

  const { data: transactions, error: transactionsError } =
    await supabase
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
        )
      `)
      .order("payment_date", { ascending: false });

  if (transactionsError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-red-600">
            Failed to load transactions:{" "}
            {transactionsError.message}
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * TRANSACTION ALLOCATIONS
   * --------------------------------------------------
   */

  const scheduleIds = (schedules ?? []).map(
    (schedule) => schedule.id
  );

  const { data: allocations, error: allocationsError } =
    scheduleIds.length > 0
      ? await supabase
          .from("transaction_allocations")
          .select(`
            id,
            transaction_id,
            payment_schedule_id,
            amount
          `)
          .in("payment_schedule_id", scheduleIds)
      : { data: [], error: null };

  if (allocationsError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-red-600">
            Failed to load payment allocations:{" "}
            {allocationsError.message}
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * SERIALIZE DATA
   *
   * We intentionally normalize Supabase relationships
   * here so the client component doesn't have to deal
   * with the "never" / array-or-object TypeScript issue.
   * --------------------------------------------------
   */

  const normalizedPolicies = (policies ?? []).map((policy) => {
    const client = Array.isArray(policy.clients)
      ? policy.clients[0]
      : policy.clients;

    return {
      id: policy.id,
      policyNumber: policy.policy_number,
      policyType: policy.policy_type,
      startDate: policy.start_date,
      endDate: policy.end_date,
      totalPrice: Number(policy.total_price ?? 0),
      clientId: policy.client_id,
      clientName: client?.full_name ?? "Unknown",
      clientIdNumber: client?.id_number ?? "",
    };
  });

  const normalizedSchedules = (schedules ?? []).map((schedule) => {
    const policy = Array.isArray(schedule.policies)
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
      sequenceNumber: schedule.sequence_number,
      description: schedule.description,
      amountDue: Number(schedule.amount_due ?? 0),
      dueDate: schedule.due_date,
      policyNumber: policy?.policy_number ?? "Unknown",
      policyType: policy?.policy_type ?? "Unknown",
      clientId: policy?.client_id ?? "",
      clientName: client?.full_name ?? "Unknown",
      clientIdNumber: client?.id_number ?? "",
    };
  });

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
        clientName: client?.full_name ?? "Unknown",
        clientIdNumber: client?.id_number ?? "",
        policyNumber: policy?.policy_number ?? "-",
        policyType: policy?.policy_type ?? "-",
      };
    }
  );

  const normalizedAllocations = (allocations ?? []).map(
    (allocation) => ({
      id: allocation.id,
      transactionId: allocation.transaction_id,
      paymentScheduleId: allocation.payment_schedule_id,
      amount: Number(allocation.amount ?? 0),
    })
  );

  /*
   * --------------------------------------------------
   * SEND EVERYTHING TO CLIENT COMPONENT
   * --------------------------------------------------
   */

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