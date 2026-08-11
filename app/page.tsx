import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type ClientRelation = {
  full_name: string;
};

type PolicyWithClient = {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number | string;
  clients: ClientRelation | ClientRelation[] | null;
};

type TransactionWithClient = {
  id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  description: string | null;
  policy_id: string;
  clients: ClientRelation | ClientRelation[] | null;
};

type ScheduleWithPolicy = {
  id: string;
  policy_id: string;
  amount_due: number | string;
  due_date: string;
  policies:
    | {
        policy_number: string;
        client_id: string;
        clients: ClientRelation | ClientRelation[] | null;
      }
    | {
        policy_number: string;
        client_id: string;
        clients: ClientRelation | ClientRelation[] | null;
      }[]
    | null;
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

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = getToday();
  const tenDaysFromNow = addDays(today, 10);

  // --------------------------------------------------
  // CLIENT COUNT
  // --------------------------------------------------

  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", {
      count: "exact",
      head: true,
    });

  // --------------------------------------------------
  // POLICIES
  // --------------------------------------------------

  const { data: policies } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      start_date,
      end_date,
      total_price,
      clients (
        full_name
      )
    `)
    .order("end_date", { ascending: true });

  const allPolicies =
    (policies as unknown as PolicyWithClient[]) || [];

  const activePolicies = allPolicies.filter(
    (policy) =>
      policy.start_date <= today &&
      policy.end_date >= today
  );

  const expiredPolicies = allPolicies.filter(
    (policy) => policy.end_date < today
  );

  const upcomingRenewals = allPolicies.filter(
    (policy) =>
      policy.end_date >= today &&
      policy.end_date <= tenDaysFromNow
  );

  // --------------------------------------------------
  // TRANSACTIONS
  // --------------------------------------------------

  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id,
      amount,
      payment_date,
      payment_method,
      description,
      policy_id,
      clients (
        full_name
      )
    `)
    .order("payment_date", {
      ascending: false,
    })
    .limit(10);

  const recentTransactions =
    (transactions as unknown as TransactionWithClient[]) || [];

  // --------------------------------------------------
  // MONTHLY PAYMENTS
  // --------------------------------------------------

  const monthStart = new Date();

  monthStart.setDate(1);

  const monthStartString = monthStart
    .toISOString()
    .split("T")[0];

  const { data: monthlyTransactions } =
    await supabase
      .from("transactions")
      .select("amount")
      .gte("payment_date", monthStartString)
      .lte("payment_date", today);

  const monthlyReceipts =
    monthlyTransactions?.reduce(
      (sum, transaction) =>
        sum + Number(transaction.amount || 0),
      0
    ) || 0;

  // --------------------------------------------------
  // OUTSTANDING DEBT
  // --------------------------------------------------

  const { data: schedules } = await supabase
    .from("payment_schedule")
    .select(`
      id,
      policy_id,
      amount_due,
      due_date,
      policies (
        policy_number,
        client_id,
        clients (
          full_name
        )
      )
    `);

  const typedSchedules =
    (schedules as unknown as ScheduleWithPolicy[]) || [];

  const scheduleIds = typedSchedules.map(
    (item) => item.id
  );

  const { data: allocations } =
    scheduleIds.length > 0
      ? await supabase
          .from("transaction_allocations")
          .select(`
            payment_schedule_id,
            amount
          `)
          .in(
            "payment_schedule_id",
            scheduleIds
          )
      : { data: [] };

  const paidBySchedule = new Map<
    string,
    number
  >();

  for (const allocation of allocations || []) {
    const current =
      paidBySchedule.get(
        allocation.payment_schedule_id
      ) || 0;

    paidBySchedule.set(
      allocation.payment_schedule_id,
      current +
        Number(allocation.amount || 0)
    );
  }

  const debtorMap = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      amount: number;
    }
  >();

  for (const schedule of typedSchedules) {
    const amountDue =
      Number(schedule.amount_due || 0);

    const amountPaid =
      paidBySchedule.get(schedule.id) || 0;

    const remaining = Math.max(
      amountDue - amountPaid,
      0
    );

    if (remaining <= 0) {
      continue;
    }

    const policy = Array.isArray(
      schedule.policies
    )
      ? schedule.policies[0]
      : schedule.policies;

    if (!policy) {
      continue;
    }

    const client = policy.clients;

    if (!client) {
      continue;
    }

    const clientName = Array.isArray(client)
      ? client[0]?.full_name || "Unknown"
      : client.full_name || "Unknown";

    const clientId = policy.client_id;

    const existing =
      debtorMap.get(clientId);

    if (existing) {
      existing.amount += remaining;
    } else {
      debtorMap.set(clientId, {
        clientId,
        clientName,
        amount: remaining,
      });
    }
  }

  const debtors = Array.from(
    debtorMap.values()
  )
    .sort(
      (a, b) => b.amount - a.amount
    )
    .slice(0, 10);

  const totalOutstanding =
    Array.from(
      debtorMap.values()
    ).reduce(
      (sum, debtor) =>
        sum + debtor.amount,
      0
    );

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Insurance Dashboard
            </h1>

            <p className="mt-2 text-gray-600">
              Overview of your insurance office.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/policies/new"
              className="rounded-md bg-black px-5 py-2 text-white hover:bg-gray-800"
            >
              Add Policy
            </Link>

            <Link
              href="/clients/new"
              className="rounded-md border bg-white px-5 py-2 hover:bg-gray-100"
            >
              Add Client
            </Link>
          </div>
        </div>

        {/* SUMMARY CARDS */}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Clients
            </p>

            <p className="mt-2 text-3xl font-bold">
              {clientCount || 0}
            </p>

            <Link
              href="/clients"
              className="mt-3 inline-block text-sm underline"
            >
              View clients
            </Link>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Active Policies
            </p>

            <p className="mt-2 text-3xl font-bold">
              {activePolicies.length}
            </p>

            <Link
              href="/policies"
              className="mt-3 inline-block text-sm underline"
            >
              View policies
            </Link>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Renewals in Next 10 Days
            </p>

            <p className="mt-2 text-3xl font-bold">
              {upcomingRenewals.length}
            </p>

            <p className="mt-3 text-sm text-gray-500">
              {today} → {tenDaysFromNow}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Outstanding Debt
            </p>

            <p className="mt-2 text-3xl font-bold">
              {formatMoney(totalOutstanding)}
            </p>

            <Link
              href="/accounting"
              className="mt-3 inline-block text-sm underline"
            >
              View accounting
            </Link>
          </div>

        </section>

        {/* SECONDARY SUMMARY */}

        <section className="mt-6 grid gap-4 md:grid-cols-3">

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Payments This Month
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(monthlyReceipts)}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Expired Policies
            </p>

            <p className="mt-2 text-2xl font-bold">
              {expiredPolicies.length}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Policies
            </p>

            <p className="mt-2 text-2xl font-bold">
              {allPolicies.length}
            </p>
          </div>

        </section>

        {/* UPCOMING RENEWALS */}

        <section className="mt-8 rounded-lg border bg-white p-6">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Upcoming Renewals
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Policies expiring within the next
                10 days.
              </p>
            </div>

            <Link
              href="/policies"
              className="text-sm underline"
            >
              View all
            </Link>
          </div>

          {upcomingRenewals.length === 0 ? (
            <p className="mt-6 text-gray-500">
              No policies are due for renewal
              within the next 10 days.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">

              <table className="w-full border-collapse">

                <thead>
                  <tr className="border-b text-left">

                    <th className="p-3">
                      Client
                    </th>

                    <th className="p-3">
                      Policy
                    </th>

                    <th className="p-3">
                      Type
                    </th>

                    <th className="p-3">
                      Expiry
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {upcomingRenewals.map(
                    (policy) => {

                      const client =
                        Array.isArray(
                          policy.clients
                        )
                          ? policy.clients[0]
                          : policy.clients;

                      return (
                        <tr
                          key={policy.id}
                          className="border-b"
                        >

                          <td className="p-3">
                            {client?.full_name ||
                              "Unknown"}
                          </td>

                          <td className="p-3">
                            <Link
                              href={`/policies/${policy.id}`}
                              className="font-medium underline"
                            >
                              {policy.policy_number}
                            </Link>
                          </td>

                          <td className="p-3">
                            {policy.policy_type}
                          </td>

                          <td className="p-3">
                            {policy.end_date}
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

        {/* DEBTORS + TRANSACTIONS */}

        <section className="mt-8 grid gap-8 lg:grid-cols-2">

          {/* DEBTORS */}

          <div className="rounded-lg border bg-white p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold">
                  Top Debtors
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Customers with the highest
                  outstanding balances.
                </p>
              </div>

              <Link
                href="/accounting"
                className="text-sm underline"
              >
                View accounting
              </Link>

            </div>

            {debtors.length === 0 ? (
              <p className="mt-6 text-gray-500">
                No outstanding debts.
              </p>
            ) : (
              <div className="mt-6 space-y-3">

                {debtors.map((debtor) => (
                  <div
                    key={debtor.clientId}
                    className="flex items-center justify-between border-b pb-3"
                  >

                    <div>
                      <p className="font-medium">
                        {debtor.clientName}
                      </p>
                    </div>

                    <p className="font-semibold">
                      {formatMoney(
                        debtor.amount
                      )}
                    </p>

                  </div>
                ))}

              </div>
            )}

          </div>

          {/* RECENT TRANSACTIONS */}

          <div className="rounded-lg border bg-white p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-semibold">
                  Recent Transactions
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Latest recorded payments.
                </p>
              </div>

              <Link
                href="/accounting"
                className="text-sm underline"
              >
                View all
              </Link>

            </div>

            {recentTransactions.length === 0 ? (
              <p className="mt-6 text-gray-500">
                No transactions recorded.
              </p>
            ) : (
              <div className="mt-6 space-y-3">

                {recentTransactions.map(
                  (transaction) => {

                    const client =
                      Array.isArray(
                        transaction.clients
                      )
                        ? transaction.clients[0]
                        : transaction.clients;

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between border-b pb-3"
                      >

                        <div>

                          <p className="font-medium">
                            {client?.full_name ||
                              "Unknown"}
                          </p>

                          <p className="text-sm text-gray-500">
                            {transaction.payment_date}{" "}
                            ·{" "}
                            {transaction.payment_method}
                          </p>

                        </div>

                        <p className="font-semibold">
                          {formatMoney(
                            Number(
                              transaction.amount
                            )
                          )}
                        </p>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}