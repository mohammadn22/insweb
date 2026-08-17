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

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "Paid":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";

    case "Partially Paid":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";

    case "Partially Overdue":
      return "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200";

    case "Overdue":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";

    case "Due":
      return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";

    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200";
  }
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "cash":
      return "نقدی";
    case "card":
      return "کارت";
    case "bank_transfer":
      return "انتقال بانکی";
    case "check":
      return "چک";
    default:
      return method;
  }
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
    <main
      dir="rtl"
      className="min-h-screen bg-[#f8fafc] text-[#1a1a1a]"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">

        {/* ==================================================
            TOP NAVIGATION
        ================================================== */}

        <div className="mb-7">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#0066CC] transition-colors hover:text-[#0052a3]"
          >
            <span aria-hidden="true">←</span>
            بازگشت به مشتریان
          </Link>
        </div>

        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0066CC]">
                  پرونده مشتری
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl">
                {client.full_name}
              </h1>

              <p className="mt-2 text-sm text-[#666666] sm:text-base">
                نمای کلی پروفایل، بیمه‌نامه‌ها و وضعیت مالی مشتری
              </p>
            </div>

            <div className="shrink-0">
              <PrintClientButton />
            </div>

          </div>
        </header>

        {/* ==================================================
            CLIENT INFORMATION
        ================================================== */}

        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white shadow-sm">

          <div className="border-b border-[#e5e7eb] px-5 py-5 sm:px-6">
            <h2 className="text-xl font-bold">
              اطلاعات مشتری
            </h2>

            <p className="mt-1 text-sm text-[#666666]">
              اطلاعات تماس و مشخصات ثبت‌شده مشتری
            </p>
          </div>

          <div className="px-5 py-6 sm:px-6">

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

              <div>
                <p className="text-xs font-semibold text-[#666666]">
                  نام و نام خانوادگی
                </p>

                <p className="mt-2 font-semibold text-[#1a1a1a]">
                  {client.full_name}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#666666]">
                  شماره ملی
                </p>

                <p className="mt-2 font-semibold text-[#1a1a1a]">
                  {client.id_number}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#666666]">
                  شماره تماس
                </p>

                <p className="mt-2 font-semibold text-[#1a1a1a]">
                  {client.mobile || (
                    <span className="font-normal text-gray-400">
                      ثبت نشده
                    </span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#666666]">
                  آدرس
                </p>

                <p className="mt-2 line-clamp-2 font-semibold leading-6 text-[#1a1a1a]">
                  {client.address || (
                    <span className="font-normal text-gray-400">
                      ثبت نشده
                    </span>
                  )}
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ==================================================
            FINANCIAL SUMMARY
        ================================================== */}

        <section className="mb-6">

          <div className="mb-4">
            <h2 className="text-xl font-bold">
              خلاصه وضعیت مالی
            </h2>

            <p className="mt-1 text-sm text-[#666666]">
              وضعیت کلی حساب این مشتری
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* TOTAL VALUE */}

            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">

              <p className="text-sm font-medium text-[#666666]">
                مبلغ کل بیمه‌نامه‌ها
              </p>

              <p className="mt-3 text-2xl font-bold tracking-tight">
                {formatMoney(totalPolicyValue)}
              </p>

              <p className="mt-1 text-xs text-[#888888]">
                تومان
              </p>

            </div>

            {/* PAID */}

            <div className="rounded-xl border border-[#d1fae5] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">

              <div className="flex items-center justify-between gap-3">

                <p className="text-sm font-medium text-[#666666]">
                  مجموع پرداختی
                </p>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  پرداخت
                </span>

              </div>

              <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-600">
                {formatMoney(totalPaid)}
              </p>

              <p className="mt-1 text-xs text-[#888888]">
                تومان
              </p>

            </div>

            {/* OUTSTANDING */}

            <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">

              <div className="flex items-center justify-between gap-3">

                <p className="text-sm font-medium text-red-600">
بدهی کل
                </p>

                <span className="rounded-full text-red-600 px-2.5 py-1 text-xs font-semibold text-[#0066CC]">
                  مانده
                </span>

              </div>

              <p className="mt-3 text-2xl font-bold tracking-tight text-red-600">
                {formatMoney(totalOutstanding)}
              </p>

              <p className="mt-1 text-xs text-[#888888]">
                تومان
              </p>

            </div>

            {/* OVERDUE */}

            <div
              className={`rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                overdueAmount > 0
                  ? "border-red-100"
                  : "border-[#e5e7eb]"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <p className="text-sm font-medium text-[#666666]">
                  معوقه
                </p>

                {overdueAmount > 0 ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                    سررسید گذشته
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    بدون معوقه
                  </span>
                )}

              </div>

              <p
                className={`mt-3 text-2xl font-bold tracking-tight ${
                  overdueAmount > 0
                    ? "text-red-600"
                    : "text-[#555555]"
                }`}
              >
                {formatMoney(overdueAmount)}
              </p>

              <p className="mt-1 text-xs text-[#888888]">
                تومان
              </p>

            </div>

          </div>
        </section>

        {/* ==================================================
            POLICIES
        ================================================== */}

        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white shadow-sm">

          <div className="flex flex-col gap-2 border-b border-[#e5e7eb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div>
              <h2 className="text-xl font-bold">
                بیمه‌نامه‌ها
              </h2>

              <p className="mt-1 text-sm text-[#666666]">
                تمام بیمه‌نامه‌های ثبت‌شده برای این مشتری
              </p>
            </div>

            <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {policies.length} بیمه‌نامه
            </span>

          </div>

          {policiesError && (
            <div className="p-5">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                بارگذاری بیمه‌نامه‌ها ناموفق بود.
              </div>
            </div>
          )}

          {!policiesError && policies.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-[#444444]">
                بیمه‌نامه‌ای برای این مشتری یافت نشد.
              </p>

              <p className="mt-1 text-sm text-[#888888]">
                پس از ثبت بیمه‌نامه، اطلاعات آن در این بخش نمایش داده می‌شود.
              </p>
            </div>
          )}

          {policies.length > 0 && (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px]">

                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f5f5f5]">

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      شماره بیمه‌نامه
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      نوع بیمه
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      تاریخ شروع
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      تاریخ پایان
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      مبلغ کل
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      پرداخت شده
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      باقیمانده
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      عملیات
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {policies.map((policy, index) => {

                    const policyPaid = transactions
                      .filter(
                        (transaction) =>
                          transaction.policy_id === policy.id
                      )
                      .reduce(
                        (sum, transaction) =>
                          sum +
                          Number(transaction.amount || 0),
                        0
                      );

                    const policyRemaining = Math.max(
                      Number(policy.total_price) -
                        policyPaid,
                      0
                    );

                    return (
                      <tr
                        key={policy.id}
                        className={`border-b border-[#e5e7eb] transition-colors hover:bg-[#f8fafc] ${
                          index % 2 === 1
                            ? "bg-[#fafafa]"
                            : "bg-white"
                        }`}
                      >

                        <td className="px-5 py-4 text-sm font-semibold text-[#1a1a1a]">
                          {policy.policy_number}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#555555]">
                          {policy.policy_type}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#555555]">
                          {policy.start_date}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#555555]">
                          {policy.end_date}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold">
                          {formatMoney(
                            Number(policy.total_price)
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-emerald-600">
                          {formatMoney(policyPaid)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-red-600">
                          {formatMoney(policyRemaining)}
                        </td>

                        <td className="px-5 py-4 text-sm">

                          <Link
                            href={`/policies/${policy.id}`}
                            className="inline-flex rounded-md px-2.5 py-1.5 font-medium text-[#0066CC] transition-colors hover:bg-blue-50 hover:text-[#0052a3]"
                          >
                            مشاهده
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

        {/* ==================================================
            PAYMENT SCHEDULE
        ================================================== */}

        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white shadow-sm">

          <div className="border-b border-[#e5e7eb] px-5 py-5 sm:px-6">

            <h2 className="text-xl font-bold">
              جدول مالی
            </h2>

            <p className="mt-1 text-sm text-[#666666]">
              وضعیت سررسیدها، پرداخت‌ها و بدهی‌های مشتری
            </p>

          </div>

          {schedules.length === 0 ? (
            <div className="px-6 py-12 text-center">

              <p className="font-medium text-[#444444]">
                اطلاعات پرداختی برای این مشتری یافت نشد.
              </p>

              <p className="mt-1 text-sm text-[#888888]">
                برنامه پرداخت پس از ثبت بیمه‌نامه نمایش داده می‌شود.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[950px]">

                <thead>

                  <tr className="border-b border-[#e5e7eb] bg-[#f5f5f5]">

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      شماره بیمه
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      نوع سند
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      تاریخ سررسید
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      مبلغ
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      پرداختی
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      بدهکار
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      وضعیت
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {schedules.map((schedule, index) => {

                    const paid =
                      paidBySchedule.get(
                        schedule.id
                      ) ?? 0;

                    const remaining = Math.max(
                      Number(schedule.amount_due) -
                        paid,
                      0
                    );

                    const status =
                      getPaymentStatus(
                        Number(schedule.amount_due),
                        paid,
                        schedule.due_date
                      );

                    const policy = policies.find(
                      (item) =>
                        item.id ===
                        schedule.policy_id
                    );

                    return (
                      <tr
                        key={schedule.id}
                        className={`border-b border-[#e5e7eb] transition-colors hover:bg-[#f8fafc] ${
                          index % 2 === 1
                            ? "bg-[#fafafa]"
                            : "bg-white"
                        }`}
                      >

                        <td className="px-5 py-4 text-sm font-semibold">
                          {policy?.policy_number || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#555555]">
                          {schedule.description}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#555555]">
                          {schedule.due_date}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold">
                          {formatMoney(
                            Number(schedule.amount_due)
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-emerald-600">
                          {formatMoney(paid)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-red-600">
                          {formatMoney(remaining)}
                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeColor(
                              status
                            )}`}
                          >
                            {status}
                          </span>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* ==================================================
            PAYMENT HISTORY
        ================================================== */}

        <section className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm">

          <div className="border-b border-[#e5e7eb] px-5 py-5 sm:px-6">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-xl font-bold">
                  تاریخچه پرداخت
                </h2>

                <p className="mt-1 text-sm text-[#666666]">
                  تمام تراکنش‌های مالی ثبت‌شده برای مشتری
                </p>
              </div>

              <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {transactions.length} تراکنش
              </span>

            </div>

          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">

              <p className="font-medium text-[#444444]">
                سابقه پرداختی برای این مشتری یافت نشد.
              </p>

              <p className="mt-1 text-sm text-[#888888]">
                پس از ثبت پرداخت، تراکنش‌ها در این بخش نمایش داده می‌شوند.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[800px]">

                <thead>

                  <tr className="border-b border-[#e5e7eb] bg-[#f5f5f5]">

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      تاریخ
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      شماره بیمه
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      مبلغ
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      روش پرداخت
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold text-[#555555]">
                      توضیحات
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {transactions.map(
                    (transaction, index) => {

                      const policy =
                        policies.find(
                          (item) =>
                            item.id ===
                            transaction.policy_id
                        );

                      return (
                        <tr
                          key={transaction.id}
                          className={`border-b border-[#e5e7eb] transition-colors hover:bg-[#f8fafc] ${
                            index % 2 === 1
                              ? "bg-[#fafafa]"
                              : "bg-white"
                          }`}
                        >

                          <td className="px-5 py-4 text-sm text-[#555555]">
                            {transaction.payment_date}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold">
                            {policy?.policy_number || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm font-bold text-emerald-600">
                            {formatMoney(
                              Number(transaction.amount)
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm">

                            <span className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {getPaymentMethodLabel(
                                transaction.payment_method
                              )}
                            </span>

                          </td>

                          <td className="px-5 py-4 text-sm text-[#666666]">
                            {transaction.description || "—"}
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