import { createClient } from "@/lib/supabase-server";
import PaymentFollowupSelect from "./PaymentFollowupSelect";

type Client = {
  full_name: string;
  mobile: string | null;
};

type Policy = {
  policy_number: string;
  clients: Client | Client[] | null;
};

type Allocation = {
  amount: number | string;
};

type PaymentSchedule = {
  id: string;
  amount_due: number | string;
  due_date: string;
  description: string | null;
  policies: Policy | Policy[] | null;
  transaction_allocations: Allocation[] | null;
};

type PaymentFollowup = {
  payment_schedule_id: string;
  status: "first" | "second" | "third" | "paid";
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatDate(date: string) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00`));
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);

  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
}

function getClient(
  clients: Client | Client[] | null
): Client | null {
  if (!clients) {
    return null;
  }

  if (Array.isArray(clients)) {
    return clients[0] ?? null;
  }

  return clients;
}

function getPolicy(
  policies: Policy | Policy[] | null
): Policy | null {
  if (!policies) {
    return null;
  }

  if (Array.isArray(policies)) {
    return policies[0] ?? null;
  }

  return policies;
}

export default async function FollowUpPage() {
  const supabase = await createClient();

  // --------------------------------------------------
  // DATES
  // --------------------------------------------------

  const today = getToday();
  const threeDaysFromNow = addDays(today, 3);

  // --------------------------------------------------
  // PAYMENT SCHEDULES
  // --------------------------------------------------

  const {
    data: schedules,
    error: schedulesError,
  } = await supabase
    .from("payment_schedule")
    .select(`
      id,
      amount_due,
      due_date,
      description,
      policies (
        policy_number,
        clients (
          full_name,
          mobile
        )
      ),
      transaction_allocations (
        amount
      )
    `)
    .gte("due_date", today)
    .lte("due_date", threeDaysFromNow)
    .order("due_date", {
      ascending: true,
    });

  if (schedulesError) {
    console.error(
      "Follow-up payment schedules error:",
      schedulesError
    );
  }

  const typedSchedules =
    (schedules as unknown as PaymentSchedule[]) ?? [];

  // --------------------------------------------------
  // REMOVE FULLY PAID INSTALLMENTS
  // --------------------------------------------------

  const unpaidSchedules = typedSchedules.filter(
    (schedule) => {
      const amountDue = Number(schedule.amount_due || 0);

      const amountPaid = (
        schedule.transaction_allocations ?? []
      ).reduce(
        (total, allocation) =>
          total + Number(allocation.amount || 0),
        0
      );

      const remaining = Math.max(
        amountDue - amountPaid,
        0
      );

      return remaining > 0;
    }
  );

  // --------------------------------------------------
  // GET SAVED FOLLOW-UP STATUS
  // --------------------------------------------------

  const scheduleIds = unpaidSchedules.map(
    (schedule) => schedule.id
  );

  let savedFollowups: PaymentFollowup[] = [];

  if (scheduleIds.length > 0) {
    const {
      data: followupData,
      error: followupError,
    } = await supabase
      .from("payment_followups")
      .select(`
        payment_schedule_id,
        status
      `)
      .in(
        "payment_schedule_id",
        scheduleIds
      );

    if (followupError) {
      console.error(
        "Follow-up status error:",
        followupError
      );
    } else {
      savedFollowups =
        (followupData as PaymentFollowup[]) ?? [];
    }
  }

  // --------------------------------------------------
  // CREATE EASY LOOKUP
  // --------------------------------------------------

  const followupStatusMap =
    new Map<string, PaymentFollowup["status"]>();

  for (const followup of savedFollowups) {
    followupStatusMap.set(
      followup.payment_schedule_id,
      followup.status
    );
  }

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
            پیگیری
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            پیگیری پرداخت‌ها و تمدید بیمه‌نامه‌ها
          </p>
        </header>

        {/* ==================================================
            PAYMENT FOLLOW-UP SECTION
        ================================================== */}

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">
            <h2 className="text-lg font-bold text-gray-950">
              پیگیری پرداخت‌ها
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              پرداخت‌های امروز و سه روز آینده
            </p>
          </div>

          {schedulesError ? (
            <div className="px-5 py-8 text-sm text-red-600">
              خطا در بارگذاری پرداخت‌ها.
            </div>
          ) : unpaidSchedules.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              در حال حاضر پرداختی برای پیگیری وجود ندارد.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[850px] text-right">

                <thead className="bg-gray-50 text-xs text-gray-500">

                  <tr>

                    <th className="px-5 py-3 font-medium">
                      مشتری
                    </th>

                    <th className="px-5 py-3 font-medium">
                      شماره تماس
                    </th>

                    <th className="px-5 py-3 font-medium">
                      مبلغ
                    </th>

                    <th className="px-5 py-3 font-medium">
                      تاریخ سررسید
                    </th>

                    <th className="px-5 py-3 font-medium">
                      وضعیت پیگیری
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {unpaidSchedules.map((schedule) => {

                    const policy =
                      getPolicy(schedule.policies);

                    const client =
                      getClient(policy?.clients ?? null);

                    const savedStatus =
                      followupStatusMap.get(
                        schedule.id
                      );

                    const statusLabel =
                      savedStatus === "first"
                        ? "پیگیری اول"
                        : savedStatus === "second"
                        ? "پیگیری دوم"
                        : savedStatus === "third"
                        ? "پیگیری سوم"
                        : "بدون پیگیری";

                    return (
                      <tr
                        key={schedule.id}
                        className="hover:bg-gray-50"
                      >

                        <td className="px-5 py-4 text-sm font-medium text-gray-900">
                          {client?.full_name ?? "نامشخص"}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {client?.mobile ?? "—"}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-gray-900">
                          {formatMoney(
                            Number(schedule.amount_due || 0)
                          )}{" "}
                          ریال
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {formatDate(
                            schedule.due_date
                          )}
                        </td>

                        <td className="px-5 py-4">
  <PaymentFollowupSelect
    paymentScheduleId={schedule.id}
    currentStatus={savedStatus ?? null}
  />
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
            RENEWAL SECTION
        ================================================== */}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-5">

            <h2 className="text-lg font-bold text-gray-950">
              پیگیری تمدید بیمه‌نامه‌ها
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              بیمه‌نامه‌هایی که در ۱۰ روز آینده به پایان می‌رسند
            </p>

          </div>

          <div className="px-5 py-10 text-center text-sm text-gray-500">
            بخش پیگیری تمدید بیمه‌نامه‌ها در مرحله بعدی تکمیل می‌شود.
          </div>

        </section>

      </div>
    </main>
  );
}