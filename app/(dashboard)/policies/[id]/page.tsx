import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddPaymentButton from "./AddPaymentButton";
import DeletePolicyButton from "./DeletePolicyButton";

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
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function formatDate(date: string) {
  if (!date) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "نقد";

    case "bank_transfer":
      return "انتقال بانکی";

    case "card":
      return "کارت";

    case "other":
      return "سایر";

    default:
      return method;
  }
}

function getPaymentStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: string
) {
  const remaining = Math.max(amountDue - amountPaid, 0);

  if (remaining <= 0) {
    return "پرداخت شده";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${dueDate}T00:00:00`);

  if (amountPaid > 0 && due < today) {
    return "تاخیر جزئی";
  }

  if (amountPaid > 0) {
    return "پرداخت جزئی";
  }

  if (due < today) {
    return "سررسید گذشته";
  }

  return "سررسید نشده";
}

function getStatusStyle(status: string) {
  switch (status) {
    case "پرداخت شده":
      return "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200";

    case "تاخیر جزئی":
      return "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200";

    case "سررسید گذشته":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";

    case "پرداخت جزئی":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";

    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200";
  }
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

  const {
    data: policyData,
    error: policyError,
  } = await supabase
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
  // CALCULATE ALLOCATED AMOUNT FOR EACH SCHEDULE
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
  // POLICY TOTALS
  // --------------------------------------------------

  const totalPrice = Number(policy.total_price || 0);

  const totalTransactionAmount = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );

  const totalAllocatedAmount = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.amount || 0),
    0
  );

  const unallocatedAmount = Math.max(
    totalTransactionAmount - totalAllocatedAmount,
    0
  );

  const totalOutstanding = Math.max(
    totalPrice - totalAllocatedAmount,
    0
  );

  const paidPercentage =
    totalPrice > 0
      ? Math.min((totalAllocatedAmount / totalPrice) * 100, 100)
      : 0;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f8fafc] text-[#1a1a1a]"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">

        {/* PAGE HEADER */}
        <header className="mb-8">
          <Link
            href={`/clients/${policy.client_id}`}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#0066CC] transition-colors hover:text-[#0052a3]"
          >
            <span aria-hidden="true">←</span>
            بازگشت به مشتری
          </Link>
<div className="flex flex-wrap items-center justify-start gap-3" dir="ltr">
  <Link
    href={`/policies/${policy.id}/edit`}
    className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0066CC] px-5 text-sm font-semibold text-white transition hover:bg-[#0052a3]"
  >
    ویرایش بیمه‌نامه
  </Link>

  <DeletePolicyButton
    policyId={policy.id}
    policyNumber={policy.policy_number}
  />
</div>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0066CC]">
                  {policy.policy_type}
                </span>

                {totalOutstanding <= 0 ? (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    تسویه شده
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    تسویه نشده
                  </span>
                )}
              </div>
              

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                بیمه‌نامه {policy.policy_number}
              </h1>

              {client && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#666666]">
                  <span>{client.full_name}</span>

                  {client.id_number && (
                    <>
                      <span className="hidden text-gray-300 sm:inline">
                        |
                      </span>
                      <span>کد ملی: {client.id_number}</span>
                    </>
                  )}

                  {client.mobile && (
                    <>
                      <span className="hidden text-gray-300 sm:inline">
                        |
                      </span>
                      <span>{client.mobile}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* POLICY INFORMATION */}
        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">اطلاعات بیمه‌نامه</h2>
              <p className="mt-1 text-sm text-[#666666]">
                اطلاعات اصلی قرارداد و بازه اعتبار بیمه‌نامه
              </p>
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="mb-2 text-xs font-semibold text-[#666666]">
                شماره بیمه‌نامه
              </p>
              <p className="font-semibold">{policy.policy_number}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#666666]">
                نوع بیمه‌نامه
              </p>
              <p className="font-semibold">{policy.policy_type}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#666666]">
                تاریخ شروع
              </p>
              <p className="font-semibold">
                {formatDate(policy.start_date)}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#666666]">
                تاریخ پایان
              </p>
              <p className="font-semibold">
                {formatDate(policy.end_date)}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#666666]">
                تعداد اقساط
              </p>
              <p className="font-semibold">
                {policy.installment_count}
              </p>
            </div>
          </div>
        </section>

        {/* FINANCIAL SUMMARY */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#666666]">مجموع قیمت</p>
            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalPrice)}
            </p>
            <p className="mt-1 text-xs text-[#666666]">ریال</p>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#666666]">مجموع دریافتی</p>
            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalTransactionAmount)}
            </p>
            <p className="mt-1 text-xs text-[#666666]">ریال</p>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#666666]">تخصیص یافته</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {formatMoney(totalAllocatedAmount)}
            </p>
            <p className="mt-1 text-xs text-[#666666]">ریال</p>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#666666]">باقی‌مانده</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatMoney(totalOutstanding)}
            </p>
            <p className="mt-1 text-xs text-[#666666]">ریال</p>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#666666]">تخصیص نیافته</p>
            <p className="mt-2 text-2xl font-bold text-orange-600">
              {formatMoney(unallocatedAmount)}
            </p>

            {unallocatedAmount > 0 ? (
              <p className="mt-1 text-xs text-orange-600">
                دریافت شده اما تخصیص نیافته
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#666666]">
                بدون مبلغ اضافی
              </p>
            )}
          </div>
        </section>

        {/* PAYMENT PROGRESS */}
        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#666666]">
                وضعیت پرداخت بیمه‌نامه
              </p>

              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-xl font-bold">
                  {totalOutstanding <= 0
                    ? "بیمه‌نامه به‌طور کامل پرداخت شده"
                    : "بیمه‌نامه هنوز تسویه نشده"}
                </h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    totalOutstanding <= 0
                      ? "bg-green-50 text-green-700"
                      : "bg-orange-50 text-orange-700"
                  }`}
                >
                  {Math.round(paidPercentage)}٪ پرداخت
                </span>
              </div>
            </div>

            <div className="text-left">
              <p className="text-sm text-[#666666]">مانده حساب</p>
              <p className="mt-1 text-xl font-bold">
                {formatMoney(totalOutstanding)} ریال
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#0066CC] transition-all"
              style={{ width: `${paidPercentage}%` }}
            />
          </div>

          {unallocatedAmount > 0 && (
            <div className="mt-5 rounded-lg border-r-4 border-orange-400 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              مبلغ{" "}
              <strong>{formatMoney(unallocatedAmount)} ریال</strong>{" "}
              دریافت شده اما هنوز به برنامه پرداخت تخصیص داده نشده است.
            </div>
          )}
        </section>

        {/* PAYMENT SCHEDULE */}
        <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="border-b border-[#e5e7eb] p-5 sm:p-6">
            <h2 className="text-xl font-bold">برنامه پرداخت</h2>
            <p className="mt-1 text-sm text-[#666666]">
              وضعیت هر پرداخت و مبلغ باقی‌مانده آن
            </p>
          </div>

          {scheduleError && (
            <div className="m-5 rounded-lg border-r-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
              خطا در بارگذاری برنامه پرداخت: {scheduleError.message}
            </div>
          )}

          {allocationsError && (
            <div className="mx-5 mb-5 rounded-lg border-r-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
              خطا در بارگذاری تخصیص پرداخت‌ها:{" "}
              {allocationsError.message}
            </div>
          )}

          {!scheduleError && schedule.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f5f5f5]">
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      #
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      توضیح
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      تاریخ سررسید
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      مبلغ سررسید
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      پرداخت شده
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      باقی‌مانده
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      وضعیت
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {schedule.map((item, index) => {
                    const amountDue = Number(item.amount_due || 0);

                    const amountPaid =
                      paidBySchedule.get(item.id) || 0;

                    const remaining = Math.max(
                      amountDue - amountPaid,
                      0
                    );

                    const overallocated = Math.max(
                      amountPaid - amountDue,
                      0
                    );

                    const status = getPaymentStatus(
                      amountDue,
                      amountPaid,
                      item.due_date
                    );

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-[#e5e7eb] transition-colors hover:bg-[#f8fafc] ${
                          index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4 text-sm">
                          {item.sequence_number === 0
                            ? "-"
                            : item.sequence_number}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium">
                          {item.description}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#666666]">
                          {formatDate(item.due_date)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold">
                          {formatMoney(amountDue)}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          <span className="font-semibold">
                            {formatMoney(amountPaid)}
                          </span>

                          {overallocated > 0 && (
                            <p className="mt-1 text-xs text-orange-600">
                              +{formatMoney(overallocated)} اضافی
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold">
                          {formatMoney(remaining)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
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

          {!scheduleError && schedule.length === 0 && (
            <div className="p-8 text-center text-sm text-[#666666]">
              برنامه پرداختی برای این بیمه‌نامه پیدا نشد.
            </div>
          )}
        </section>
        
          {/* ADD PAYMENT */}
          <section className="mb-6 rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  پرداخت‌ها
                </h2>

                <p className="mt-1 text-sm text-[#666666]">
                  برای ثبت دریافت جدید از این گزینه استفاده کنید.
                </p>
              </div>

              <AddPaymentButton policyId={id} />
            </div>
          </section>

        {/* TRANSACTIONS */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="border-b border-[#e5e7eb] p-5 sm:p-6">
            <h2 className="text-xl font-bold">تراکنش‌ها</h2>
            <p className="mt-1 text-sm text-[#666666]">
              تمام پرداخت‌های ثبت‌شده برای این بیمه‌نامه
            </p>
          </div>

          {transactionsError && (
            <div className="m-5 rounded-lg border-r-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
              خطا در بارگذاری تراکنش‌ها:{" "}
              {transactionsError.message}
            </div>
          )}

          {!transactionsError && transactions.length === 0 && (
            <div className="p-8 text-center">
              <p className="font-medium">هنوز تراکنشی ثبت نشده است.</p>
              <p className="mt-1 text-sm text-[#666666]">
                پس از ثبت اولین پرداخت، اطلاعات آن در این بخش نمایش داده
                می‌شود.
              </p>
            </div>
          )}

          {!transactionsError && transactions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f5f5f5]">
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      تاریخ
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      مبلغ
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      روش پرداخت
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      توضیح
                    </th>
                    <th className="px-5 py-4 text-right text-sm font-bold">
                      تخصیص یافته به
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction, index) => {
                    const transactionAllocations =
                      allocations.filter(
                        (allocation) =>
                          allocation.transaction_id === transaction.id
                      );

                    const allocatedAmount =
                      transactionAllocations.reduce(
                        (sum, allocation) =>
                          sum + Number(allocation.amount || 0),
                        0
                      );

                    const transactionUnallocated = Math.max(
                      Number(transaction.amount || 0) -
                        allocatedAmount,
                      0
                    );

                    return (
                      <tr
                        key={transaction.id}
                        className={`border-b border-[#e5e7eb] transition-colors hover:bg-[#f8fafc] ${
                          index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4 text-sm text-[#666666]">
                          {formatDate(transaction.payment_date)}
                        </td>

                        <td className="px-5 py-4 text-sm font-bold">
                          {formatMoney(
                            Number(transaction.amount)
                          )}{" "}
                          ریال
                        </td>

                        <td className="px-5 py-4 text-sm">
                          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {formatPaymentMethod(
                              transaction.payment_method
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#666666]">
                          {transaction.description || "-"}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {transactionAllocations.length === 0 ? (
                            <div>
                              <span className="text-[#666666]">-</span>

                              {transactionUnallocated > 0 && (
                                <p className="mt-1 text-xs font-medium text-orange-600">
                                  {formatMoney(
                                    transactionUnallocated
                                  )}{" "}
                                  تخصیص نیافته
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {transactionAllocations.map(
                                (allocation, allocationIndex) => {
                                  const scheduleItem =
                                    Array.isArray(
                                      allocation.payment_schedule
                                    )
                                      ? allocation.payment_schedule[0]
                                      : allocation.payment_schedule;

                                  return (
                                    <div
                                      key={`${allocation.payment_schedule_id}-${allocationIndex}`}
                                      className="flex items-center justify-between gap-4 rounded-md bg-gray-50 px-3 py-2"
                                    >
                                      <span>
                                        {scheduleItem?.description ||
                                          `قسط ${
                                            scheduleItem?.sequence_number ??
                                            "-"
                                          }`}
                                      </span>

                                      <span className="font-semibold whitespace-nowrap">
                                        {formatMoney(
                                          Number(allocation.amount)
                                        )}
                                      </span>
                                    </div>
                                  );
                                }
                              )}

                              {transactionUnallocated > 0 && (
                                <p className="mt-2 text-xs font-medium text-orange-600">
                                  {formatMoney(
                                    transactionUnallocated
                                  )}{" "}
                                  تخصیص نیافته
                                </p>
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
      </div>
    </main>
  );
}