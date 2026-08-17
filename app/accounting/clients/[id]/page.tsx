import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PolicyAccounting = {
  policy_id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number;
  total_paid: number;
  outstanding_balance: number;
};

type Transaction = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  description: string | null;
  policy_id: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatDate(dateString: string) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPolicyStatus(endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(`${endDate}T00:00:00`);

  return end < today ? "منقضی شده" : "فعال";
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "نقدی";

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

function getPaymentMethodClass(method: string) {
  switch (method) {
    case "cash":
      return "bg-green-50 text-green-700 border-green-200";

    case "bank_transfer":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "card":
      return "bg-purple-50 text-purple-700 border-purple-200";

    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export default async function ClientAccountingPage({
  params,
}: ClientPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const { data: client, error: clientError } =
    await supabase
      .from("clients")
      .select(
        "id, full_name, id_number, mobile, address"
      )
      .eq("id", id)
      .single();

  if (clientError || !client) {
    notFound();
  }

  const { data: policies, error: policiesError } =
    await supabase
      .from("policy_accounting")
      .select(`
        policy_id,
        policy_number,
        policy_type,
        start_date,
        end_date,
        total_price,
        total_paid,
        outstanding_balance
      `)
      .eq("client_id", id)
      .order("start_date", {
        ascending: false,
      });

  const policyList =
    (policies || []) as PolicyAccounting[];

  const {
    data: transactions,
    error: transactionsError,
  } = await supabase
    .from("transactions")
    .select(`
      id,
      amount,
      payment_date,
      payment_method,
      description,
      policy_id
    `)
    .eq("client_id", id)
    .order("payment_date", {
      ascending: false,
    });

  const transactionList =
    (transactions || []) as Transaction[];

  const totalPolicyValue = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.total_price),
    0
  );

  const totalPaid = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.total_paid),
    0
  );

  const totalOutstanding = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.outstanding_balance),
    0
  );

  const transactionTotal = transactionList.reduce(
    (sum, transaction) =>
      sum + Number(transaction.amount),
    0
  );

  const policyNumberMap = new Map(
    policyList.map((policy) => [
      policy.policy_id,
      policy.policy_number,
    ])
  );

  const policiesWithDebt = policyList.filter(
    (policy) =>
      Number(policy.outstanding_balance) > 0
  );

  const activePolicies = policyList.filter(
    (policy) =>
      getPolicyStatus(policy.end_date) === "فعال"
  ).length;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-7xl">

        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                <Link
                  href="/clients"
                  className="transition hover:text-blue-600"
                >
                  مشتریان
                </Link>

                <span>←</span>

                <span>حسابداری مشتری</span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {client.full_name}
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500 sm:text-base">
                مشاهده اطلاعات مشتری، بیمه‌نامه‌ها و
                سوابق مالی
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <Link
                href="/accounting/debtors"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow"
              >
                مشاهده بدهکاران
              </Link>

              <Link
                href="/clients"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow"
              >
                بازگشت به مشتریان
              </Link>

            </div>
          </div>
        </header>

        {/* ==================================================
            CLIENT INFORMATION
        ================================================== */}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 bg-gray-50 px-5 py-5 sm:px-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  اطلاعات مشتری
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  اطلاعات شناسایی و تماس مشتری
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-700">
                {client.full_name.charAt(0)}
              </div>

            </div>
          </div>

          <div className="grid divide-y divide-gray-200 sm:grid-cols-2 sm:divide-y-0">

            <div className="border-b border-gray-200 p-5 sm:border-l sm:p-6">
              <p className="text-xs font-medium text-gray-500">
                نام کامل
              </p>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {client.full_name}
              </p>
            </div>

            <div className="border-b border-gray-200 p-5 sm:p-6">
              <p className="text-xs font-medium text-gray-500">
                شماره شناسایی
              </p>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {client.id_number || "-"}
              </p>
            </div>

            <div className="border-b border-gray-200 p-5 sm:border-l sm:p-6 sm:border-b-0">
              <p className="text-xs font-medium text-gray-500">
                شماره موبایل
              </p>

              <p className="mt-2 text-base font-semibold text-gray-900">
                {client.mobile || "-"}
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-xs font-medium text-gray-500">
                آدرس
              </p>

              <p className="mt-2 text-base font-semibold leading-7 text-gray-900">
                {client.address || "-"}
              </p>
            </div>

          </div>
        </section>

        {/* ==================================================
            FINANCIAL SUMMARY
        ================================================== */}

        <section className="mt-6">

          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              خلاصه مالی
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              وضعیت کلی حساب مشتری
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* TOTAL VALUE */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm text-gray-500">
                    ارزش کل بیمه‌نامه‌ها
                  </p>

                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {formatMoney(totalPolicyValue)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    ریال
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  ₼
                </div>

              </div>
            </div>

            {/* PAID */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm text-gray-500">
                    مجموع پرداخت‌شده
                  </p>

                  <p className="mt-3 text-2xl font-bold text-green-600">
                    {formatMoney(totalPaid)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    ریال
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  ✓
                </div>

              </div>
            </div>

            {/* OUTSTANDING */}

            <div
              className={`rounded-xl border p-5 shadow-sm ${
                totalOutstanding > 0
                  ? "border-amber-200 bg-amber-50/40"
                  : "border-gray-200 bg-white"
              }`}
            >

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm text-gray-500">
                    مبلغ باقی‌مانده
                  </p>

                  <p
                    className={`mt-3 text-2xl font-bold ${
                      totalOutstanding > 0
                        ? "text-amber-700"
                        : "text-gray-900"
                    }`}
                  >
                    {formatMoney(totalOutstanding)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    ریال
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  !
                </div>

              </div>
            </div>

            {/* TRANSACTIONS */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm text-gray-500">
                    تعداد تراکنش‌ها
                  </p>

                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    {new Intl.NumberFormat("fa-IR").format(
                      transactionList.length
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    مجموع: {formatMoney(transactionTotal)} ریال
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  ↔
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ==================================================
            QUICK STATUS
        ================================================== */}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="grid gap-5 sm:grid-cols-3">

            <div>
              <p className="text-sm text-gray-500">
                تعداد بیمه‌نامه‌ها
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {new Intl.NumberFormat("fa-IR").format(
                  policyList.length
                )}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                بیمه‌نامه‌های فعال
              </p>

              <p className="mt-2 text-xl font-bold text-green-600">
                {new Intl.NumberFormat("fa-IR").format(
                  activePolicies
                )}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                بیمه‌نامه‌های دارای بدهی
              </p>

              <p className="mt-2 text-xl font-bold text-amber-600">
                {new Intl.NumberFormat("fa-IR").format(
                  policiesWithDebt.length
                )}
              </p>
            </div>

          </div>
        </section>

        {/* ==================================================
            POLICIES
        ================================================== */}

        <section className="mt-8">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                بیمه‌نامه‌ها
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                فهرست تمام بیمه‌نامه‌های این مشتری
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {new Intl.NumberFormat("fa-IR").format(
                policiesWithDebt.length
              )}{" "}
              بیمه‌نامه دارای بدهی
            </div>

          </div>

          {policiesError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p className="font-semibold">
                خطا در بارگذاری بیمه‌نامه‌ها
              </p>

              <p className="mt-1">
                {policiesError.message}
              </p>
            </div>
          )}

          {!policiesError &&
            policyList.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  —
                </div>

                <h3 className="mt-4 font-semibold text-gray-900">
                  بیمه‌نامه‌ای ثبت نشده است
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  برای این مشتری هنوز بیمه‌نامه‌ای ثبت
                  نشده است.
                </p>

              </div>
            )}

          {policyList.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[1050px] border-collapse">

                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        بیمه‌نامه
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        نوع بیمه
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        تاریخ شروع
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        تاریخ پایان
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        وضعیت
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        مبلغ کل
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        پرداخت‌شده
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        باقی‌مانده
                      </th>

                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600">
                        عملیات
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {policyList.map((policy, index) => {

                      const outstanding =
                        Number(
                          policy.outstanding_balance
                        );

                      const status =
                        getPolicyStatus(
                          policy.end_date
                        );

                      return (
                        <tr
                          key={policy.policy_id}
                          className={`border-b border-gray-100 transition hover:bg-gray-50 ${
                            index % 2 === 1
                              ? "bg-gray-50/40"
                              : "bg-white"
                          }`}
                        >

                          <td className="px-4 py-4">

                            <Link
                              href={`/policies/${policy.policy_id}`}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {policy.policy_number}
                            </Link>

                          </td>

                          <td className="px-4 py-4 text-sm text-gray-700">
                            {policy.policy_type}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(
                              policy.start_date
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(
                              policy.end_date
                            )}
                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                status === "فعال"
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                              }`}
                            >
                              {status}
                            </span>

                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-gray-800">
                            {formatMoney(
                              Number(
                                policy.total_price
                              )
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm font-medium text-green-700">
                            {formatMoney(
                              Number(
                                policy.total_paid
                              )
                            )}
                          </td>

                          <td className="px-4 py-4">

                            <span
                              className={`text-sm font-bold ${
                                outstanding > 0
                                  ? "text-amber-700"
                                  : "text-gray-500"
                              }`}
                            >
                              {formatMoney(
                                outstanding
                              )}
                            </span>

                          </td>

                          <td className="px-4 py-4">

                            <Link
                              href={`/policies/${policy.policy_id}`}
                              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                              مشاهده جزئیات
                            </Link>

                          </td>

                        </tr>
                      );
                    })}

                  </tbody>

                </table>

              </div>

            </div>
          )}

        </section>

        {/* ==================================================
            TRANSACTION HISTORY
        ================================================== */}

        <section className="mt-10 pb-10">

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                سابقه تراکنش‌ها
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                تمام پرداخت‌های ثبت‌شده برای این مشتری
              </p>
            </div>

            {transactionList.length > 0 && (
              <div className="text-sm text-gray-500">
                مجموع پرداخت‌ها:{" "}
                <span className="font-bold text-gray-900">
                  {formatMoney(transactionTotal)}
                </span>{" "}
                ریال
              </div>
            )}

          </div>

          {transactionsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p className="font-semibold">
                خطا در بارگذاری تراکنش‌ها
              </p>

              <p className="mt-1">
                {transactionsError.message}
              </p>
            </div>
          )}

          {!transactionsError &&
            transactionList.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  —
                </div>

                <h3 className="mt-4 font-semibold text-gray-900">
                  تراکنشی ثبت نشده است
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  هنوز هیچ پرداختی برای این مشتری ثبت نشده
                  است.
                </p>

              </div>
            )}

          {transactionList.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[800px] border-collapse">

                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">

                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-600">
                        تاریخ
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-600">
                        بیمه‌نامه
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-600">
                        مبلغ
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-600">
                        روش پرداخت
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold text-gray-600">
                        توضیحات
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {transactionList.map(
                      (transaction, index) => {

                        const policyNumber =
                          transaction.policy_id
                            ? policyNumberMap.get(
                                transaction.policy_id
                              )
                            : null;

                        return (
                          <tr
                            key={transaction.id}
                            className={`border-b border-gray-100 transition hover:bg-gray-50 ${
                              index % 2 === 1
                                ? "bg-gray-50/40"
                                : "bg-white"
                            }`}
                          >

                            <td className="px-5 py-4 text-sm text-gray-700">
                              {formatDate(
                                transaction.payment_date
                              )}
                            </td>

                            <td className="px-5 py-4">

                              {transaction.policy_id &&
                              policyNumber ? (
                                <Link
                                  href={`/policies/${transaction.policy_id}`}
                                  className="text-sm font-semibold text-blue-600 hover:underline"
                                >
                                  {policyNumber}
                                </Link>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  نامشخص
                                </span>
                              )}

                            </td>

                            <td className="px-5 py-4">

                              <span className="text-sm font-bold text-gray-900">
                                {formatMoney(
                                  Number(
                                    transaction.amount
                                  )
                                )}
                              </span>

                              <span className="mr-1 text-xs text-gray-400">
                                ریال
                              </span>

                            </td>

                            <td className="px-5 py-4">

                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentMethodClass(
                                  transaction.payment_method
                                )}`}
                              >
                                {formatPaymentMethod(
                                  transaction.payment_method
                                )}
                              </span>

                            </td>

                            <td className="px-5 py-4 text-sm text-gray-600">
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

            </div>
          )}

        </section>

      </div>
    </main>
  );
}