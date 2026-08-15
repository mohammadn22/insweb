import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PrintClientButton from "../PrintClientButton";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Client = {
  id: string;
  full_name: string;
  id_number: string;
  mobile: string | null;
  address: string | null;
};

type Policy = {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number;
};

type PaymentSchedule = {
  id: string;
  policy_id: string;
  sequence_number: number;
  description: string;
  amount_due: number;
  due_date: string;
};

type Transaction = {
  id: string;
  policy_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  description: string | null;
};

type Allocation = {
  transaction_id: string;
  payment_schedule_id: string;
  amount: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPaymentStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: string
) {
  const remaining = Math.max(
    amountDue - amountPaid,
    0
  );

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

export default async function ClientDetailsPage({
  params,
}: ClientPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // --------------------------------------------------
  // CLIENT
  // --------------------------------------------------

  const {
    data: clientData,
    error: clientError,
  } = await supabase
    .from("clients")
    .select(`
      id,
      full_name,
      id_number,
      mobile,
      address
    `)
    .eq("id", id)
    .single();

  if (clientError || !clientData) {
    notFound();
  }

  const client = clientData as Client;

  // --------------------------------------------------
  // POLICIES
  // --------------------------------------------------

  const {
    data: policiesData,
    error: policiesError,
  } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      start_date,
      end_date,
      total_price
    `)
    .eq("client_id", id)
    .order("start_date", {
      ascending: false,
    });

  const policies = (policiesData ?? []) as Policy[];

  // --------------------------------------------------
  // PAYMENT SCHEDULE
  // --------------------------------------------------

  const policyIds = policies.map(
    (policy) => policy.id
  );

  let schedules: PaymentSchedule[] = [];

  if (policyIds.length > 0) {
    const {
      data: schedulesData,
      error: schedulesError,
    } = await supabase
      .from("payment_schedule")
      .select(`
        id,
        policy_id,
        sequence_number,
        description,
        amount_due,
        due_date
      `)
      .in("policy_id", policyIds)
      .order("due_date");

    if (schedulesError) {
      throw new Error(
        schedulesError.message
      );
    }

    schedules =
      (schedulesData ?? []) as PaymentSchedule[];
  }

  // --------------------------------------------------
  // TRANSACTIONS
  // --------------------------------------------------

  let transactions: Transaction[] = [];

  if (policyIds.length > 0) {
    const {
      data: transactionsData,
      error: transactionsError,
    } = await supabase
      .from("transactions")
      .select(`
        id,
        policy_id,
        amount,
        payment_date,
        payment_method,
        description
      `)
      .in("policy_id", policyIds)
      .order("payment_date", {
        ascending: false,
      });

    if (transactionsError) {
      throw new Error(
        transactionsError.message
      );
    }

    transactions =
      (transactionsData ?? []) as Transaction[];
  }

  // --------------------------------------------------
  // ALLOCATIONS
  // --------------------------------------------------

  let allocations: Allocation[] = [];

  const scheduleIds = schedules.map(
    (schedule) => schedule.id
  );

  if (scheduleIds.length > 0) {
    const {
      data: allocationsData,
      error: allocationsError,
    } = await supabase
      .from("transaction_allocations")
      .select(`
        transaction_id,
        payment_schedule_id,
        amount
      `)
      .in(
        "payment_schedule_id",
        scheduleIds
      );

    if (allocationsError) {
      throw new Error(
        allocationsError.message
      );
    }

    allocations =
      (allocationsData ?? []) as Allocation[];
  }

  // --------------------------------------------------
  // PAID BY SCHEDULE
  // --------------------------------------------------

  const paidBySchedule = new Map<
    string,
    number
  >();

  for (const allocation of allocations) {
    const current =
      paidBySchedule.get(
        allocation.payment_schedule_id
      ) ?? 0;

    paidBySchedule.set(
      allocation.payment_schedule_id,
      current + Number(allocation.amount || 0)
    );
  }

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  const totalPolicyValue =
    policies.reduce(
      (sum, policy) =>
        sum + Number(policy.total_price || 0),
      0
    );

  const totalPaid =
    transactions.reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    );

  const totalOutstanding = Math.max(
    totalPolicyValue - totalPaid,
    0
  );

  // --------------------------------------------------
  // OVERDUE
  // --------------------------------------------------

  const today =
    new Date().toISOString().split("T")[0];

  let overdueAmount = 0;

  for (const schedule of schedules) {
    const paid =
      paidBySchedule.get(schedule.id) ?? 0;

    const remaining = Math.max(
      Number(schedule.amount_due) - paid,
      0
    );

    if (
      remaining > 0 &&
      schedule.due_date < today
    ) {
      overdueAmount += remaining;
    }
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8">

          <Link
            href="/clients"
            className="text-sm underline"
          >
            ← Back to Clients
          </Link>


<div className="flex items-center justify-between">
  <h1 className="text-3xl font-bold">
    {client.full_name}
  </h1>

  <PrintClientButton />
</div>

          <p className="mt-2 text-gray-600">
            Client financial overview
          </p>

        </div>

        {/* CLIENT INFORMATION */}

        <section className="rounded-lg border bg-white p-6">

          <h2 className="text-xl font-semibold">
            Client Information
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <p className="text-sm text-gray-500">
                Full Name
              </p>

              <p className="mt-1 font-medium">
                {client.full_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                ID Number
              </p>

              <p className="mt-1 font-medium">
                {client.id_number}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Mobile
              </p>

              <p className="mt-1 font-medium">
                {client.mobile || "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Address
              </p>

              <p className="mt-1 font-medium">
                {client.address || "-"}
              </p>
            </div>

          </div>

        </section>

        {/* FINANCIAL SUMMARY */}

        <section className="mt-8">

          <h2 className="text-xl font-semibold">
            Financial Summary
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">

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
                Total Paid
              </p>

              <p className="mt-2 text-2xl font-bold">
                {formatMoney(totalPaid)}
              </p>
            </div>

            <div className="rounded-lg border bg-white p-5">
              <p className="text-sm text-gray-500">
                Outstanding
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

          </div>

        </section>

        {/* POLICIES */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <h2 className="text-xl font-semibold">
            Policies
          </h2>

          {policiesError && (
            <p className="mt-4 text-red-600">
              Failed to load policies.
            </p>
          )}

          {!policiesError &&
            policies.length === 0 && (
              <p className="mt-4 text-gray-500">
                No policies found.
              </p>
            )}

          {policies.length > 0 && (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

                    <th className="p-3">
                      Policy
                    </th>

                    <th className="p-3">
                      Type
                    </th>

                    <th className="p-3">
                      Start Date
                    </th>

                    <th className="p-3">
                      End Date
                    </th>

                    <th className="p-3">
                      Total Price
                    </th>

                    <th className="p-3">
                      Paid
                    </th>

                    <th className="p-3">
                      Remaining
                    </th>

                    <th className="p-3">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {policies.map((policy) => {

                    const policyPaid =
                      transactions
                        .filter(
                          (transaction) =>
                            transaction.policy_id ===
                            policy.id
                        )
                        .reduce(
                          (sum, transaction) =>
                            sum +
                            Number(
                              transaction.amount || 0
                            ),
                          0
                        );

                    const policyRemaining =
                      Math.max(
                        Number(policy.total_price) -
                          policyPaid,
                        0
                      );

                    return (
                      <tr
                        key={policy.id}
                        className="border-b"
                      >

                        <td className="p-3 font-medium">
                          {policy.policy_number}
                        </td>

                        <td className="p-3">
                          {policy.policy_type}
                        </td>

                        <td className="p-3">
                          {policy.start_date}
                        </td>

                        <td className="p-3">
                          {policy.end_date}
                        </td>

                        <td className="p-3">
                          {formatMoney(
                            Number(
                              policy.total_price
                            )
                          )}
                        </td>

                        <td className="p-3">
                          {formatMoney(policyPaid)}
                        </td>

                        <td className="p-3 font-semibold">
                          {formatMoney(
                            policyRemaining
                          )}
                        </td>

                        <td className="p-3">

                          <Link
                            href={`/policies/${policy.id}`}
                            className="text-sm underline"
                          >
                            View Policy
                          </Link>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* PAYMENT SCHEDULE */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <h2 className="text-xl font-semibold">
            Outstanding Payment Schedule
          </h2>

          {schedules.length === 0 ? (
            <p className="mt-4 text-gray-500">
              No payment schedules found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b bg-gray-50 text-left">

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
                      Amount Due
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

                  {schedules.map((schedule) => {

                    const paid =
                      paidBySchedule.get(
                        schedule.id
                      ) ?? 0;

                    const remaining =
                      Math.max(
                        Number(
                          schedule.amount_due
                        ) - paid,
                        0
                      );

                    const status =
                      getPaymentStatus(
                        Number(
                          schedule.amount_due
                        ),
                        paid,
                        schedule.due_date
                      );

                    const policy =
                      policies.find(
                        (item) =>
                          item.id ===
                          schedule.policy_id
                      );

                    return (
                      <tr
                        key={schedule.id}
                        className="border-b"
                      >

                        <td className="p-3">
                          {policy?.policy_number ||
                            "-"}
                        </td>

                        <td className="p-3">
                          {schedule.description}
                        </td>

                        <td className="p-3">
                          {schedule.due_date}
                        </td>

                        <td className="p-3">
                          {formatMoney(
                            Number(
                              schedule.amount_due
                            )
                          )}
                        </td>

                        <td className="p-3">
                          {formatMoney(paid)}
                        </td>

                        <td className="p-3 font-semibold">
                          {formatMoney(
                            remaining
                          )}
                        </td>

                        <td className="p-3">
                          {status}
                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* PAYMENT HISTORY */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <h2 className="text-xl font-semibold">
            Payment History
          </h2>

          {transactions.length === 0 ? (
            <p className="mt-4 text-gray-500">
              No payments recorded.
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

                  </tr>
                </thead>

                <tbody>

                  {transactions.map(
                    (transaction) => {

                      const policy =
                        policies.find(
                          (item) =>
                            item.id ===
                            transaction.policy_id
                        );

                      return (
                        <tr
                          key={transaction.id}
                          className="border-b"
                        >

                          <td className="p-3">
                            {transaction.payment_date}
                          </td>

                          <td className="p-3">
                            {policy?.policy_number ||
                              "-"}
                          </td>

                          <td className="p-3 font-semibold">
                            {formatMoney(
                              Number(
                                transaction.amount
                              )
                            )}
                          </td>

                          <td className="p-3">
                            {transaction.payment_method}
                          </td>

                          <td className="p-3">
                            {transaction.description ||
                              "-"}
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

      </div>
    </main>
  );
}