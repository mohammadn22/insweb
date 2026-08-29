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
        clients:
          | ClientRelation
          | ClientRelation[]
          | null;
      }
    | {
        policy_number: string;
        client_id: string;
        clients:
          | ClientRelation
          | ClientRelation[]
          | null;
      }[]
    | null;
};

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatDate(dateString: string) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function addDays(
  dateString: string,
  days: number
) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
}

function getPaymentMethodLabel(
  method: string
) {
  switch (method) {
    case "cash":
      return "نقدی";

    case "installment":
      return "قسطی";

    case "card":
      return "کارتخوان";

    case "transfer":
      return "واریز بانکی";

    case "online":
      return "آنلاین";

    default:
      return method || "نامشخص";
  }
}

/* --------------------------------------------------
   DASHBOARD
-------------------------------------------------- */

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

  /* --------------------------------------------------
     CLIENT COUNT
  -------------------------------------------------- */

  const { count: clientCount } =
    await supabase
      .from("clients")
      .select("*", {
        count: "exact",
        head: true,
      });

  /* --------------------------------------------------
     POLICIES
  -------------------------------------------------- */

  const { data: policies } =
    await supabase
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
      .order("end_date", {
        ascending: true,
      });

  const allPolicies =
    (policies as unknown as PolicyWithClient[]) ||
    [];

  const activePolicies =
    allPolicies.filter(
      (policy) =>
        policy.start_date <= today &&
        policy.end_date >= today
    );

  const expiredPolicies =
    allPolicies.filter(
      (policy) =>
        policy.end_date < today
    );

  const upcomingRenewals =
    allPolicies.filter(
      (policy) =>
        policy.end_date >= today &&
        policy.end_date <= tenDaysFromNow
    );

  /* --------------------------------------------------
     TRANSACTIONS
  -------------------------------------------------- */

  const { data: transactions } =
    await supabase
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
    (transactions as unknown as TransactionWithClient[]) ||
    [];

  /* --------------------------------------------------
     MONTHLY PAYMENTS
  -------------------------------------------------- */

  const monthStart = new Date();

  monthStart.setDate(1);

  const monthStartString =
    monthStart.toISOString().split("T")[0];

  const {
    data: monthlyTransactions,
  } = await supabase
    .from("transactions")
    .select("amount")
    .gte(
      "payment_date",
      monthStartString
    )
    .lte("payment_date", today);

  const monthlyReceipts =
    monthlyTransactions?.reduce(
      (sum, transaction) =>
        sum +
        Number(transaction.amount || 0),
      0
    ) || 0;

  /* --------------------------------------------------
     OUTSTANDING DEBT
  -------------------------------------------------- */

  const { data: schedules } =
    await supabase
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
    (schedules as unknown as ScheduleWithPolicy[]) ||
    [];

  const scheduleIds =
    typedSchedules.map(
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
        Number(
          allocation.amount || 0
        )
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
      paidBySchedule.get(
        schedule.id
      ) || 0;

    const remaining = Math.max(
      amountDue - amountPaid,
      0
    );

    if (remaining <= 0) {
      continue;
    }

        if (schedule.due_date >= today) {
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

    const clientName =
      Array.isArray(client)
        ? client[0]?.full_name ||
          "نامشخص"
        : client.full_name ||
          "نامشخص";

    const clientId =
      policy.client_id;

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
      (a, b) =>
        b.amount - a.amount
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

  /* --------------------------------------------------
     DASHBOARD
  -------------------------------------------------- */

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ==============================================
            HEADER
        ============================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <span>خانه</span>
                <span className="text-gray-300">
                  /
                </span>
                <span className="text-gray-700">
                  داشبورد
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
                داشبورد مدیریت
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                نمای کلی وضعیت مشتریان، بیمه‌نامه‌ها و امور مالی
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/clients/new"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-400 hover:bg-gray-50"
              >
                افزودن مشتری
              </Link>

              <Link
                href="/policies/new"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + افزودن بیمه‌نامه
              </Link>
            </div>
          </div>
        </header>

        {/* ==============================================
            PRIMARY SUMMARY
        ============================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* CLIENTS */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  تعداد مشتریان
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
                  {formatNumber(
                    clientCount || 0
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600">
                👤
              </div>
            </div>

            <Link
              href="/clients"
              className="mt-5 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              مشاهده مشتریان ←
            </Link>
          </div>

          {/* ACTIVE POLICIES */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  بیمه‌نامه‌های فعال
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
                  {formatNumber(
                    activePolicies.length
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-lg text-green-600">
                ✓
              </div>
            </div>

            <Link
              href="/policies"
              className="mt-5 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              مشاهده بیمه‌نامه‌ها ←
            </Link>
          </div>

          {/* RENEWALS */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  تمدید در ۱۰ روز آینده
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
                  {formatNumber(
                    upcomingRenewals.length
                  )}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-lg text-amber-600">
                ↻
              </div>
            </div>

            <p className="mt-5 text-xs text-gray-500">
              از {formatDate(today)} تا{" "}
              {formatDate(
                tenDaysFromNow
              )}
            </p>
          </div>

          {/* DEBT */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                 بدهی معوق
                </p>

                <p className="mt-3 text-2xl font-bold tracking-tight text-gray-950">
                  {formatMoney(
                    totalOutstanding
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  ریال
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-lg text-red-600">
                !
              </div>
            </div>

            <Link
              href="/debtors"
              className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              مشاهده بدهکاران ←
            </Link>
          </div>
        </section>

        {/* ==============================================
            SECONDARY SUMMARY
        ============================================== */}

        <section className="mt-5 grid gap-4 md:grid-cols-3">

          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-gray-500">
              دریافت‌های ماه جاری
            </p>

            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-xl font-bold text-gray-950">
                {formatMoney(
                  monthlyReceipts
                )}
              </p>

              <span className="text-xs text-gray-400">
                ریال
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-gray-500">
              بیمه‌نامه‌های منقضی
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {formatNumber(
                expiredPolicies.length
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-gray-500">
              مجموع بیمه‌نامه‌ها
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {formatNumber(
                allPolicies.length
              )}
            </p>
          </div>
        </section>

        {/* ==============================================
            UPCOMING RENEWALS
        ============================================== */}

        <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div>
              <h2 className="text-lg font-bold text-gray-950">
                بیمه‌نامه‌های نزدیک به تمدید
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                بیمه‌نامه‌هایی که در ۱۰ روز آینده منقضی می‌شوند
              </p>
            </div>

            <Link
              href="/policies"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              مشاهده همه ←
            </Link>
          </div>

          {upcomingRenewals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                ✓
              </div>

              <p className="mt-4 text-sm font-medium text-gray-700">
                بیمه‌نامه‌ای برای تمدید وجود ندارد
              </p>

              <p className="mt-1 text-xs text-gray-400">
                در حال حاضر موردی برای پیگیری وجود ندارد.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-right">

                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500">
                      مشتری
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-gray-500">
                      شماره بیمه‌نامه
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-gray-500">
                      نوع بیمه‌نامه
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-gray-500">
                      تاریخ انقضا
                    </th>

                    <th className="px-6 py-4 text-xs font-semibold text-gray-500">
                      وضعیت
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
                          className="border-b border-gray-100 transition last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-gray-900">
                              {client?.full_name ||
                                "نامشخص"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <Link
                              href={`/policies/${policy.id}`}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                            >
                              {policy.policy_number}
                            </Link>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {policy.policy_type}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(
                              policy.end_date
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              نزدیک به تمدید
                            </span>
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

        {/* ==============================================
            DEBTORS + TRANSACTIONS
        ============================================== */}

        <section className="mt-8 grid gap-6 lg:grid-cols-2">

          {/* ============================================
              DEBTORS
          ============================================ */}

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-5 sm:px-6">

              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  بدهکاران
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  مشتریان با بیشترین بدهی
                </p>
              </div>

              <Link
                href="/debtors"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                مشاهده همه ←
              </Link>
            </div>

            {debtors.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                  ✓
                </div>

                <p className="mt-4 text-sm font-medium text-gray-700">
                  بدهی معوقی وجود ندارد
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {debtors.map(
                  (debtor, index) => (
                    <div
                      key={debtor.clientId}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-gray-50 sm:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {formatNumber(
                            index + 1
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {debtor.clientName}
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            مبلغ بدهی
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-left">
                        <p className="text-sm font-bold text-red-600">
                          {formatMoney(
                            debtor.amount
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-400">
                          ریال
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ============================================
              RECENT TRANSACTIONS
          ============================================ */}

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-5 sm:px-6">

              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  تراکنش‌های اخیر
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  آخرین پرداخت‌های ثبت‌شده
                </p>
              </div>

              <Link
                href="/accounting"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                مشاهده همه ←
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  —
                </div>

                <p className="mt-4 text-sm font-medium text-gray-700">
                  تراکنشی ثبت نشده است
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
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
                        className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-gray-50 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {client?.full_name ||
                              "نامشخص"}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span>
                              {formatDate(
                                transaction.payment_date
                              )}
                            </span>

                            <span className="text-gray-300">
                              •
                            </span>

                            <span>
                              {getPaymentMethodLabel(
                                transaction.payment_method
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-left">
                          <p className="text-sm font-bold text-green-600">
                            +{" "}
                            {formatMoney(
                              Number(
                                transaction.amount
                              )
                            )}
                          </p>

                          <p className="mt-1 text-[11px] text-gray-400">
                            ریال
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </section>

        {/* ==============================================
            FOOTER SPACING
        ============================================== */}

        <div className="h-8" />
      </div>
    </main>
  );
}