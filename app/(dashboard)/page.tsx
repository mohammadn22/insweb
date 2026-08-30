import { redirect } from "next/navigation";
import { toGregorian } from "jalaali-js";
import { createClient } from "@/lib/supabase-server";

/* ==================================================
   TYPES
================================================== */

type Client = {
  full_name: string;
};

type Policy = {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  clients:
    | Client
    | Client[]
    | null;
};

type Allocation = {
  payment_schedule_id: string;
  amount: number | string;
};

type PaymentSchedule = {
  id: string;
  policy_id: string;
  amount_due: number | string;
  due_date: string;

  policies:
    | {
        policy_number: string;
        policy_type: string;
        clients:
          | Client
          | Client[]
          | null;
      }
    | {
        policy_number: string;
        policy_type: string;
        clients:
          | Client
          | Client[]
          | null;
      }[]
    | null;

  transaction_allocations:
    | Allocation[]
    | null;
};

/* ==================================================
   POLICY TYPE LABELS
================================================== */

const POLICY_TYPE_LABELS: Record<
  string,
  string
> = {
  "بیمه شخص ثالث خودرو":
    "شخص ثالث خودرو",

  "بیمه شخص ثالث موتورسیکلت":
    "شخص ثالث موتورسیکلت",

  "بیمه شخص ثالث سایر":
    "شخص ثالث سایر",

  "بیمه آتش‌سوزی":
    "آتش‌سوزی",

  "بیمه مسئولیت":
    "مسئولیت",

  "بیمه بدنه خودرو":
    "بدنه خودرو",

  "بیمه حمل و نقل بار":
    "حمل و نقل بار",
};

/* ==================================================
   HELPERS
================================================== */

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "fa-IR"
  ).format(value);
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "fa-IR"
  ).format(Math.round(value));
}

function formatDate(
  dateString: string
) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(
    `${dateString}T00:00:00`
  );

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
  return new Date()
    .toISOString()
    .split("T")[0];
}

function addDays(
  dateString: string,
  days: number
) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  date.setDate(
    date.getDate() + days
  );

  return date
    .toISOString()
    .split("T")[0];
}

function normalizeDigits(
  value: string
) {
  return value
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
      )
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
      )
    );
}

/* ==================================================
   JALALI DATE HELPERS
================================================== */

function getCurrentJalaliYear() {
  const now = new Date();

  const formatter =
    new Intl.DateTimeFormat(
      "fa-IR-u-ca-persian",
      {
        year: "numeric",
      }
    );

  const yearString =
    normalizeDigits(
      formatter.format(now)
    );

  const year =
    parseInt(
      yearString,
      10
    );

  if (!Number.isFinite(year)) {
    throw new Error(
      `Unable to determine current Jalali year: ${yearString}`
    );
  }

  return year;
}

function jalaliToGregorianISO(
  year: number,
  month: number,
  day: number
) {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    throw new Error(
      `Invalid Jalali date: ${year}/${month}/${day}`
    );
  }

  const {
    gy,
    gm,
    gd,
  } = toGregorian(
    year,
    month,
    day
  );

  return `${gy}-${String(gm).padStart(
    2,
    "0"
  )}-${String(gd).padStart(
    2,
    "0"
  )}`;
}

function getCurrentJalaliYearRange() {
  const jalaliYear =
    getCurrentJalaliYear();

  const startDate =
    jalaliToGregorianISO(
      jalaliYear,
      1,
      1
    );

  /*
   * First day of next Jalali year.
   */
  const nextYearStart =
    jalaliToGregorianISO(
      jalaliYear + 1,
      1,
      1
    );

  /*
   * Last day of current Jalali year.
   */
  const endDateObject =
    new Date(
      `${nextYearStart}T00:00:00`
    );

  endDateObject.setDate(
    endDateObject.getDate() - 1
  );

  const endDate =
    endDateObject
      .toISOString()
      .split("T")[0];

  return {
    jalaliYear,
    startDate,
    endDate,
  };
}

/* ==================================================
   CLIENT NAME
================================================== */

function getClientName(
  client:
    | Client
    | Client[]
    | null
) {
  if (!client) {
    return "نامشخص";
  }

  if (Array.isArray(client)) {
    return (
      client[0]?.full_name ||
      "نامشخص"
    );
  }

  return (
    client.full_name ||
    "نامشخص"
  );
}

/* ==================================================
   POLICY TYPE
================================================== */

function getPolicyTypeLabel(
  policyType: string
) {
  return (
    POLICY_TYPE_LABELS[
      policyType
    ] ||
    policyType ||
    "نامشخص"
  );
}

/* ==================================================
   DASHBOARD
================================================== */

export default async function Home() {
  const supabase =
    await createClient();

  /* --------------------------------------------------
     AUTH
  -------------------------------------------------- */

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /* --------------------------------------------------
     DATES
  -------------------------------------------------- */

  const today =
    getToday();

  const threeDaysFromNow =
    addDays(
      today,
      3
    );

  const tenDaysFromNow =
    addDays(
      today,
      10
    );

  const {
    jalaliYear,
    startDate:
      jalaliYearStart,
    endDate:
      jalaliYearEnd,
  } =
    getCurrentJalaliYearRange();

  /* ==================================================
     1. POLICIES
  ================================================== */

  const {
    data: policies,
    error: policiesError,
  } =
    await supabase
      .from("policies")
      .select(`
        id,
        policy_number,
        policy_type,
        start_date,
        end_date,
        clients (
          full_name
        )
      `)
      .order(
        "end_date",
        {
          ascending: true,
        }
      );

  if (policiesError) {
    console.error(
      "Dashboard policies error:",
      policiesError.message,
      policiesError.details,
      policiesError.hint,
      policiesError.code
    );
  }

  const allPolicies =
    (policies as unknown as Policy[]) ||
    [];

  /* ==================================================
     2. UPCOMING RENEWALS
  ================================================== */

  const upcomingRenewals =
    allPolicies.filter(
      (policy) =>
        policy.end_date >= today &&
        policy.end_date <=
          tenDaysFromNow
    );

  /* ==================================================
     3. PAYMENT SCHEDULES
     
     IMPORTANT:
     transaction_allocations are fetched
     through the existing foreign-key
     relationship.

     This avoids a huge .in(...) request.
  ================================================== */

  const {
    data: schedules,
    error: schedulesError,
  } =
    await supabase
      .from("payment_schedule")
      .select(`
        id,
        policy_id,
        amount_due,
        due_date,
        policies (
          policy_number,
          policy_type,
          clients (
            full_name
          )
        ),
        transaction_allocations (
          payment_schedule_id,
          amount
        )
      `)
      .order(
        "due_date",
        {
          ascending: true,
        }
      );

  if (schedulesError) {
    console.error(
      "Dashboard payment schedule error:",
      schedulesError.message,
      schedulesError.details,
      schedulesError.hint,
      schedulesError.code
    );
  }

  const typedSchedules =
    (schedules as unknown as PaymentSchedule[]) ||
    [];

  /* ==================================================
     4. UPCOMING INSTALLMENTS
     
     TODAY + NEXT 3 DAYS
  ================================================== */

  const upcomingInstallments =
    typedSchedules.filter(
      (schedule) =>
        schedule.due_date >= today &&
        schedule.due_date <=
          threeDaysFromNow
    );

  /* ==================================================
     5. OVERDUE INSTALLMENTS
     
     due_date < today
     AND remaining > 0
  ================================================== */

  const overdueInstallments =
    typedSchedules
      .map((schedule) => {

        const amountDue =
          Number(
            schedule.amount_due || 0
          );

        const amountPaid =
          (
            schedule.transaction_allocations ||
            []
          ).reduce(
            (
              total,
              allocation
            ) =>
              total +
              Number(
                allocation.amount ||
                  0
              ),
            0
          );

        const remaining =
          Math.max(
            amountDue -
              amountPaid,
            0
          );

        return {
          schedule,
          amountDue,
          amountPaid,
          remaining,
        };
      })
      .filter(
        ({
          schedule,
          remaining,
        }) =>
          schedule.due_date <
            today &&
          remaining > 0
      );

  const totalOutstanding =
    overdueInstallments.reduce(
      (
        total,
        installment
      ) =>
        total +
        installment.remaining,
      0
    );

  /* ==================================================
     6. CURRENT JALALI YEAR POLICIES
  ================================================== */

  const currentYearPolicies =
    allPolicies.filter(
      (policy) =>
        policy.start_date >=
          jalaliYearStart &&
        policy.start_date <=
          jalaliYearEnd
    );

  /* ==================================================
     7. POLICY COUNTS BY TYPE
  ================================================== */

  const policyTypeCounts =
    new Map<string, number>();

  for (
    const policy of
      currentYearPolicies
  ) {
    const current =
      policyTypeCounts.get(
        policy.policy_type
      ) || 0;

    policyTypeCounts.set(
      policy.policy_type,
      current + 1
    );
  }

  const policyCategories =
    Array.from(
      policyTypeCounts.entries()
    )
      .map(
        ([
          policyType,
          count,
        ]) => ({
          policyType,
          label:
            getPolicyTypeLabel(
              policyType
            ),
          count,
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  /* ==================================================
     UI
  ================================================== */

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="mb-8">

          <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">
            داشبورد
          </h1>

        </header>

        {/* ==================================================
            1. UPCOMING RENEWALS
        ================================================== */}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">

            <h2 className="text-lg font-bold text-gray-950">
              تمدیدهای ۱۰ روز آینده
            </h2>

          </div>

          {upcomingRenewals.length ===
          0 ? (

            <div className="px-5 py-10 text-center text-sm text-gray-500">
              هیچ بیمه‌نامه‌ای برای تمدید در ۱۰ روز آینده وجود ندارد.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[700px] text-right">

                <thead className="bg-gray-50 text-xs text-gray-500">

                  <tr>

                    <th className="px-5 py-3 font-medium">
                      مشتری
                    </th>

                    <th className="px-5 py-3 font-medium">
                      شماره بیمه‌نامه
                    </th>

                    <th className="px-5 py-3 font-medium">
                      نوع بیمه
                    </th>

                    <th className="px-5 py-3 font-medium">
                      تاریخ انقضا
                    </th>

                    <th className="px-5 py-3 font-medium">
                      باقی‌مانده
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {upcomingRenewals.map(
                    (policy) => {

                      const endDate =
                        new Date(
                          `${policy.end_date}T00:00:00`
                        );

                      const todayDate =
                        new Date(
                          `${today}T00:00:00`
                        );

                      const daysRemaining =
                        Math.round(
                          (
                            endDate.getTime() -
                            todayDate.getTime()
                          ) /
                            (
                              1000 *
                              60 *
                              60 *
                              24
                            )
                        );

                      return (
                        <tr
                          key={
                            policy.id
                          }
                          className="hover:bg-gray-50"
                        >

                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {getClientName(
                              policy.clients
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {policy.policy_number}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {getPolicyTypeLabel(
                              policy.policy_type
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {formatDate(
                              policy.end_date
                            )}
                          </td>

                          <td className="px-5 py-4">

                            {daysRemaining ===
                            0 ? (

                              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                                امروز
                              </span>

                            ) : (

                              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                {formatNumber(
                                  daysRemaining
                                )} روز
                              </span>

                            )}

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

        {/* ==================================================
            2. UPCOMING INSTALLMENTS
        ================================================== */}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">

            <h2 className="text-lg font-bold text-gray-950">
              اقساط سررسید امروز و ۳ روز آینده
            </h2>

          </div>

          {upcomingInstallments.length ===
          0 ? (

            <div className="px-5 py-10 text-center text-sm text-gray-500">
              در این بازه قسطی برای پرداخت وجود ندارد.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[850px] text-right">

                <thead className="bg-gray-50 text-xs text-gray-500">

                  <tr>

                    <th className="px-5 py-3 font-medium">
                      تاریخ سررسید
                    </th>

                    <th className="px-5 py-3 font-medium">
                      مشتری
                    </th>

                    <th className="px-5 py-3 font-medium">
                      شماره بیمه‌نامه
                    </th>

                    <th className="px-5 py-3 font-medium">
                      نوع بیمه
                    </th>

                    <th className="px-5 py-3 font-medium">
                      مبلغ قسط
                    </th>

                    <th className="px-5 py-3 font-medium">
                      وضعیت
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {upcomingInstallments.map(
                    (schedule) => {

                      const amountDue =
                        Number(
                          schedule.amount_due ||
                            0
                        );

                      const amountPaid =
                        (
                          schedule.transaction_allocations ||
                          []
                        ).reduce(
                          (
                            total,
                            allocation
                          ) =>
                            total +
                            Number(
                              allocation.amount ||
                                0
                            ),
                          0
                        );

                      const remaining =
                        Math.max(
                          amountDue -
                            amountPaid,
                          0
                        );

                      const policy =
                        Array.isArray(
                          schedule.policies
                        )
                          ? schedule
                              .policies[0]
                          : schedule.policies;

                      const clientName =
                        getClientName(
                          policy?.clients ||
                            null
                        );

                      const isToday =
                        schedule.due_date ===
                        today;

                      const isPaid =
                        remaining <= 0;

                      const isPartial =
                        amountPaid > 0 &&
                        remaining > 0;

                      return (
                        <tr
                          key={
                            schedule.id
                          }
                          className="hover:bg-gray-50"
                        >

                          <td className="px-5 py-4">

                            <div className="flex flex-col gap-1">

                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(
                                  schedule.due_date
                                )}
                              </span>

                              {isToday && (
                                <span className="text-xs font-medium text-red-600">
                                  امروز
                                </span>
                              )}

                            </div>

                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {clientName}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {policy?.policy_number ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-700">
                            {getPolicyTypeLabel(
                              policy?.policy_type ||
                                ""
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {formatMoney(
                              amountDue
                            )}{" "}
                            ریال
                          </td>

                          <td className="px-5 py-4">

                            {isPaid ? (

                              <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                                پرداخت شده
                              </span>

                            ) : isPartial ? (

                              <div className="flex flex-col gap-1">

                                <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                  پرداخت ناقص
                                </span>

                                <span className="text-xs text-gray-500">
                                  مانده:{" "}
                                  {formatMoney(
                                    remaining
                                  )}{" "}
                                  ریال
                                </span>

                              </div>

                            ) : (

                              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                                پرداخت نشده
                              </span>

                            )}

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

        {/* ==================================================
            3. OVERDUE DEBT
        ================================================== */}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">

            <h2 className="text-lg font-bold text-gray-950">
              مجموع اقساط پرداخت‌نشده
            </h2>

          </div>

          <div className="px-5 py-8">

            <div className="flex items-baseline gap-2">

              <span className="text-3xl font-bold text-red-600">
                {formatMoney(
                  totalOutstanding
                )}
              </span>

              <span className="text-sm text-gray-500">
                ریال
              </span>

            </div>

            <p className="mt-3 text-sm text-gray-500">
              شامل{" "}
              {formatNumber(
                overdueInstallments.length
              )}{" "}
              قسط پرداخت‌نشده یا دارای پرداخت ناقص
            </p>

          </div>

        </section>

        {/* ==================================================
            4. CURRENT JALALI YEAR
        ================================================== */}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">

            <h2 className="text-lg font-bold text-gray-950">
              تعداد بیمه‌نامه‌های سال{" "}
              {formatNumber(
                jalaliYear
              )}{" "}
              به تفکیک نوع
            </h2>

          </div>

          {policyCategories.length ===
          0 ? (

            <div className="px-5 py-10 text-center text-sm text-gray-500">
              در سال جاری بیمه‌نامه‌ای ثبت نشده است.
            </div>

          ) : (

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {policyCategories.map(
                (category) => (

                  <div
                    key={
                      category.policyType
                    }
                    className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                  >

                    <p className="text-sm font-medium text-gray-500">
                      {category.label}
                    </p>

                    <p className="mt-2 text-3xl font-bold text-gray-950">
                      {formatNumber(
                        category.count
                      )}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      بیمه‌نامه
                    </p>

                  </div>

                )
              )}

            </div>

          )}

        </section>

      </div>
    </main>
  );
}