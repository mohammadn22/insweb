import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type ScheduleItem = {
  payment_schedule_id: string;
  policy_id: string;
  amount_remaining: number;
  due_date: string;
  description: string;
  policies: {
    policy_number: string;
    end_date: string;
    clients: {
      full_name: string;
      mobile: string | null;
    } | null;
  } | null;
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

export default async function AccountingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("payment_schedule_accounting")
    .select(`
      payment_schedule_id,
      policy_id,
      amount_remaining,
      due_date,
      description,
      policies (
        policy_number,
        end_date,
        clients (
          full_name,
          mobile
        )
      )
    `)
    .gt("amount_remaining", 0)
    .order("due_date", {
      ascending: true,
    });

  const items =
    (data || []) as unknown as ScheduleItem[];

  const today = getToday();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);

  const overdue = items.filter(
    (item) => item.due_date < today
  );

  const dueToday = items.filter(
    (item) => item.due_date === today
  );

  const dueTomorrow = items.filter(
    (item) => item.due_date === tomorrow
  );

  const dueInTwoDays = items.filter(
    (item) => item.due_date === dayAfterTomorrow
  );

  const overdueAmount = overdue.reduce(
    (sum, item) =>
      sum + Number(item.amount_remaining),
    0
  );

  const todayAmount = dueToday.reduce(
    (sum, item) =>
      sum + Number(item.amount_remaining),
    0
  );

  const tomorrowAmount = dueTomorrow.reduce(
    (sum, item) =>
      sum + Number(item.amount_remaining),
    0
  );

  const twoDaysAmount = dueInTwoDays.reduce(
    (sum, item) =>
      sum + Number(item.amount_remaining),
    0
  );

  const priorityItems = overdue.slice(0, 10);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Accounting
          </h1>

          <p className="mt-2 text-gray-600">
            Payment collection dashboard
          </p>
        </div>

        <Link
          href="/policies"
          className="border px-4 py-2 rounded-md"
        >
          Policies
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          Failed to load accounting data:{" "}
          {error.message}
        </div>
      )}

      {!error && (
        <>
          {/* SUMMARY CARDS */}

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/accounting/overdue"
              className="rounded-lg border p-5 hover:bg-gray-50"
            >
              <p className="text-sm text-gray-500">
                Overdue
              </p>

              <p className="mt-2 text-3xl font-bold">
                {overdue.length}
              </p>

              <p className="mt-2 text-red-600 font-medium">
                {formatMoney(overdueAmount)}
              </p>

              <p className="mt-2 text-sm underline">
                View overdue →
              </p>
            </Link>

            <Link
              href="/accounting/today"
              className="rounded-lg border p-5 hover:bg-gray-50"
            >
              <p className="text-sm text-gray-500">
                Due Today
              </p>

              <p className="mt-2 text-3xl font-bold">
                {dueToday.length}
              </p>

              <p className="mt-2 font-medium">
                {formatMoney(todayAmount)}
              </p>

              <p className="mt-2 text-sm underline">
                View today's payments →
              </p>
            </Link>

            <Link
              href="/accounting/upcoming"
              className="rounded-lg border p-5 hover:bg-gray-50"
            >
              <p className="text-sm text-gray-500">
                Due Tomorrow
              </p>

              <p className="mt-2 text-3xl font-bold">
                {dueTomorrow.length}
              </p>

              <p className="mt-2 font-medium">
                {formatMoney(tomorrowAmount)}
              </p>

              <p className="mt-2 text-sm underline">
                View upcoming →
              </p>
            </Link>

            <Link
              href="/accounting/debtors"
              className="rounded-lg border p-5 hover:bg-gray-50"
            >
              <p className="text-sm text-gray-500">
                Total Outstanding
              </p>

              <p className="mt-2 text-3xl font-bold">
                {items.length}
              </p>

              <p className="mt-2 font-medium">
                All unpaid payments
              </p>

              <p className="mt-2 text-sm underline">
                View all debtors →
              </p>
            </Link>
          </section>

          {/* PRIORITY LIST */}

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Needs Attention
                </h2>

                <p className="mt-1 text-gray-600">
                  The most urgent overdue payments
                </p>
              </div>

              <Link
                href="/accounting/overdue"
                className="text-sm underline"
              >
                View all
              </Link>
            </div>

            {priorityItems.length === 0 ? (
              <div className="mt-4 rounded-lg border p-6 text-gray-600">
                No overdue payments. 🎉
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-3 text-left">
                        Client
                      </th>

                      <th className="border p-3 text-left">
                        Mobile
                      </th>

                      <th className="border p-3 text-left">
                        Policy
                      </th>

                      <th className="border p-3 text-left">
                        Payment
                      </th>

                      <th className="border p-3 text-left">
                        Due Date
                      </th>

                      <th className="border p-3 text-left">
                        Remaining
                      </th>

                      <th className="border p-3 text-left">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {priorityItems.map((item) => {
                      const policy = item.policies;
                      const client = policy?.clients;

                      return (
                        <tr
                          key={
                            item.payment_schedule_id
                          }
                        >
                          <td className="border p-3">
                            {client?.full_name ||
                              "Unknown"}
                          </td>

                          <td className="border p-3">
                            {client?.mobile || "-"}
                          </td>

                          <td className="border p-3">
                            {policy?.policy_number ||
                              "-"}
                          </td>

                          <td className="border p-3">
                            {item.description}
                          </td>

                          <td className="border p-3">
                            {item.due_date}
                          </td>

                          <td className="border p-3 font-semibold">
                            {formatMoney(
                              Number(
                                item.amount_remaining
                              )
                            )}
                          </td>

                          <td className="border p-3">
                            <Link
                              href={`/policies/${item.policy_id}`}
                              className="underline"
                            >
                              View
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

          {/* QUICK ACTIONS */}

          <section className="mt-10">
            <h2 className="text-xl font-semibold">
              Quick Actions
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/accounting/overdue"
                className="rounded-md border px-4 py-2"
              >
                Overdue Payments
              </Link>

              <Link
                href="/accounting/today"
                className="rounded-md border px-4 py-2"
              >
                Due Today
              </Link>

              <Link
                href="/accounting/upcoming"
                className="rounded-md border px-4 py-2"
              >
                Upcoming Payments
              </Link>

              <Link
                href="/accounting/debtors"
                className="rounded-md border px-4 py-2"
              >
                All Debtors
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}