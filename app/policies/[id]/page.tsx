import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import RecordPaymentForm from "./RecordPaymentForm";

type PolicyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Client = {
  id: string;
  full_name: string;
  id_number: string;
  mobile: string | null;
};

type Policy = {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number;
  initial_payment_required: number;
  installment_count: number;
  first_installment_offset_days: number | null;
  installment_interval_days: number | null;
  client_id: string;
  clients: Client | Client[] | null;
};

type PaymentScheduleItem = {
  id: string;
  sequence_number: number;
  description: string;
  amount_due: number;
  due_date: string;
};

type Transaction = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  description: string | null;
};

type Allocation = {
  transaction_id: string;
  payment_schedule_id: string;
  amount: number;
  payment_schedule:
    | {
        sequence_number: number;
        description: string;
      }
    | {
        sequence_number: number;
        description: string;
      }[]
    | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPaymentStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: string
) {
  const remaining = Math.max(amountDue - amountPaid, 0);

  if (remaining <= 0) {
    return "Paid";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${dueDate}T00:00:00`);

  if (amountPaid > 0 && due < today) {
    return "Partially Overdue";
  }

  if (amountPaid > 0) {
    return "Partially Paid";
  }

  if (due < today) {
    return "Overdue";
  }

  return "Due";
}

export default async function PolicyDetailsPage({
  params,
}: PolicyPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // --------------------------------------------------
  // POLICY
  // --------------------------------------------------

  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      start_date,
      end_date,
      total_price,
      initial_payment_required,
      installment_count,
      first_installment_offset_days,
      installment_interval_days,
      client_id,
      clients (
        id,
        full_name,
        id_number,
        mobile
      )
    `)
    .eq("id", id)
    .single();

  if (policyError || !policyData) {
    notFound();
  }

  const policy = policyData as Policy;

  const client = Array.isArray(policy.clients)
    ? policy.clients[0] ?? null
    : policy.clients;

  // --------------------------------------------------
  // PAYMENT SCHEDULE
  // --------------------------------------------------

  const {
    data: scheduleData,
    error: scheduleError,
  } = await supabase
    .from("payment_schedule")
    .select(`
      id,
      sequence_number,
      description,
      amount_due,
      due_date
    `)
    .eq("policy_id", id)
    .order("sequence_number");

  const schedule = (scheduleData ?? []) as PaymentScheduleItem[];

  // --------------------------------------------------
  // TRANSACTIONS
  // --------------------------------------------------

  const {
    data: transactionsData,
    error: transactionsError,
  } = await supabase
    .from("transactions")
    .select(`
      id,
      amount,
      payment_date,
      payment_method,
      description
    `)
    .eq("policy_id", id)
    .order("payment_date", {
      ascending: false,
    });

  const transactions = (transactionsData ?? []) as Transaction[];

  // --------------------------------------------------
  // TRANSACTION ALLOCATIONS
  // --------------------------------------------------

  let allocations: Allocation[] = [];
  let allocationsError: { message: string } | null = null;

  const scheduleIds = schedule.map((item) => item.id);

  if (scheduleIds.length > 0) {
    const {
      data: allocationsData,
      error,
    } = await supabase
      .from("transaction_allocations")
      .select(`
        transaction_id,
        payment_schedule_id,
        amount,
        payment_schedule (
          sequence_number,
          description
        )
      `)
      .in("payment_schedule_id", scheduleIds);

    allocationsError = error;

    allocations = (allocationsData ?? []) as Allocation[];
  }

  // --------------------------------------------------
  // CALCULATE PAID AMOUNT FOR EACH SCHEDULE ITEM
  // --------------------------------------------------

  const paidBySchedule = new Map<string, number>();

  for (const allocation of allocations) {
    const current =
      paidBySchedule.get(allocation.payment_schedule_id) || 0;

    paidBySchedule.set(
      allocation.payment_schedule_id,
      current + Number(allocation.amount || 0)
    );
  }

  // --------------------------------------------------
  // CALCULATE POLICY TOTALS
  // --------------------------------------------------

  const totalPrice = Number(policy.total_price || 0);

  const totalPaid = transactions.reduce(
    (sum, transaction) =>
      sum + Number(transaction.amount || 0),
    0
  );

  const totalOutstanding = Math.max(
    totalPrice - totalPaid,
    0
  );

  const totalScheduled = schedule.reduce(
    (sum, item) =>
      sum + Number(item.amount_due || 0),
    0
  );

  // Avoid unused-variable warning while keeping this
  // useful for future validation.
  void totalScheduled;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <main className="min-h-screen p-8">
      <div className="mb-8">
        <Link
          href="/policies"
          className="text-sm underline"
        >
          ← Back to Policies
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-bold">
            Policy {policy.policy_number}
          </h1>

          <p className="mt-2 text-gray-600">
            {policy.policy_type}
          </p>
        </div>
      </div>

      {/* POLICY INFORMATION */}

      <section className="mb-8">
        <h2 className="text-xl font-semibold">
          Policy Information
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Client
            </p>

            <p className="font-medium">
              {client?.full_name || "Unknown"}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              ID Number
            </p>

            <p className="font-medium">
              {client?.id_number || "-"}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Mobile
            </p>

            <p className="font-medium">
              {client?.mobile || "-"}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Policy Type
            </p>

            <p className="font-medium">
              {policy.policy_type}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Start Date
            </p>

            <p className="font-medium">
              {policy.start_date}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              End Date
            </p>

            <p className="font-medium">
              {policy.end_date}
            </p>
          </div>
        </div>
      </section>

      {/* PAYMENT SUMMARY */}

      <section className="mb-8">
        <h2 className="text-xl font-semibold">
          Payment Summary
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Total Price
            </p>

            <p className="text-xl font-semibold">
              {formatMoney(totalPrice)}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Total Paid
            </p>

            <p className="text-xl font-semibold">
              {formatMoney(totalPaid)}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Outstanding
            </p>

            <p className="text-xl font-semibold">
              {formatMoney(totalOutstanding)}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm text-gray-500">
              Payment Status
            </p>

            <p className="text-xl font-semibold">
              {totalOutstanding <= 0
                ? "Fully Paid"
                : "Outstanding"}
            </p>
          </div>
        </div>
      </section>

      {/* PAYMENT SCHEDULE */}

      <section className="mb-8">
        <h2 className="text-xl font-semibold">
          Payment Schedule
        </h2>

        {scheduleError && (
          <p className="mt-4 text-red-600">
            Failed to load payment schedule:{" "}
            {scheduleError.message}
          </p>
        )}

        {allocationsError && (
          <p className="mt-4 text-red-600">
            Failed to load payment allocations:{" "}
            {allocationsError.message}
          </p>
        )}

        {!scheduleError &&
          schedule.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-3 text-left">
                      #
                    </th>

                    <th className="border p-3 text-left">
                      Description
                    </th>

                    <th className="border p-3 text-left">
                      Due Date
                    </th>

                    <th className="border p-3 text-left">
                      Amount Due
                    </th>

                    <th className="border p-3 text-left">
                      Paid
                    </th>

                    <th className="border p-3 text-left">
                      Remaining
                    </th>

                    <th className="border p-3 text-left">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {schedule.map((item) => {
                    const amountDue =
                      Number(item.amount_due || 0);

                    const amountPaid =
                      paidBySchedule.get(item.id) || 0;

                    const remaining = Math.max(
                      amountDue - amountPaid,
                      0
                    );

                    const status =
                      getPaymentStatus(
                        amountDue,
                        amountPaid,
                        item.due_date
                      );

                    return (
                      <tr key={item.id}>
                        <td className="border p-3">
                          {item.sequence_number === 0
                            ? "-"
                            : item.sequence_number}
                        </td>

                        <td className="border p-3">
                          {item.description}
                        </td>

                        <td className="border p-3">
                          {item.due_date}
                        </td>

                        <td className="border p-3">
                          {formatMoney(amountDue)}
                        </td>

                        <td className="border p-3">
                          {formatMoney(amountPaid)}
                        </td>

                        <td className="border p-3">
                          {formatMoney(remaining)}
                        </td>

                        <td className="border p-3">
                          {status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {!scheduleError &&
          schedule.length === 0 && (
            <p className="mt-4 text-gray-600">
              No payment schedule found.
            </p>
          )}
      </section>

      {/* RECORD PAYMENT */}

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">
          Record Payment
        </h2>

        <RecordPaymentForm policyId={id} />
      </section>

      {/* TRANSACTIONS */}

      <section>
        <h2 className="text-xl font-semibold">
          Transactions
        </h2>

        {transactionsError && (
          <p className="mt-4 text-red-600">
            Failed to load transactions:{" "}
            {transactionsError.message}
          </p>
        )}

        {!transactionsError &&
          transactions.length === 0 && (
            <p className="mt-4 text-gray-600">
              No transactions recorded.
            </p>
          )}

        {!transactionsError &&
          transactions.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-3 text-left">
                      Date
                    </th>

                    <th className="border p-3 text-left">
                      Amount
                    </th>

                    <th className="border p-3 text-left">
                      Method
                    </th>

                    <th className="border p-3 text-left">
                      Description
                    </th>

                    <th className="border p-3 text-left">
                      Allocated To
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => {
                    const transactionAllocations =
                      allocations.filter(
                        (allocation) =>
                          allocation.transaction_id ===
                          transaction.id
                      );

                    return (
                      <tr key={transaction.id}>
                        <td className="border p-3">
                          {transaction.payment_date}
                        </td>

                        <td className="border p-3 font-medium">
                          {formatMoney(
                            Number(transaction.amount)
                          )}
                        </td>

                        <td className="border p-3">
                          {transaction.payment_method}
                        </td>

                        <td className="border p-3">
                          {transaction.description || "-"}
                        </td>

                        <td className="border p-3">
                          {transactionAllocations.length ===
                          0 ? (
                            "-"
                          ) : (
                            <div className="space-y-1">
                              {transactionAllocations.map(
                                (allocation, index) => {
                                  const scheduleItem =
                                    Array.isArray(
                                      allocation.payment_schedule
                                    )
                                      ? allocation
                                          .payment_schedule[0]
                                      : allocation.payment_schedule;

                                  return (
                                    <div
                                      key={`${allocation.payment_schedule_id}-${index}`}
                                    >
                                      {scheduleItem?.description ||
                                        `Installment ${
                                          scheduleItem?.sequence_number ??
                                          "-"
                                        }`}
                                      {" — "}
                                      {formatMoney(
                                        Number(
                                          allocation.amount
                                        )
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </main>
  );
}