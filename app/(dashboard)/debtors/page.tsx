import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import DebtorsClient from "./DebtorsClient";

type ClientRelation = {
  full_name: string;
  mobile: string | null;
};

type PolicyRelation = {
  client_id: string;
  clients: ClientRelation | ClientRelation[] | null;
};

type AllocationRelation = {
  amount: number;
};

type ScheduleWithPolicy = {
  id: string;
  amount_due: number;
  due_date: string;
  policies: PolicyRelation | PolicyRelation[] | null;
  transaction_allocations: AllocationRelation | AllocationRelation[] | null;
};

export type Debtor = {
  clientId: string;
  clientName: string;
  mobile: string | null;
  totalDebt: number;
  overdueInstallments: number;
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default async function DebtorsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = getToday();

  /*
   * A debt only exists once the due date has passed. Installments due
   * today or in the future are intentionally excluded at the query
   * level so the rest of this page never has to reason about them.
   *
   * transaction_allocations is embedded directly here (instead of a
   * second query filtered with `.in(paymentScheduleId, [...])`) because
   * that second query's URL grows with the number of overdue
   * installments and can exceed request URL limits once there are many
   * rows (e.g. after a large policy import), causing a hard
   * "fetch failed" at the network layer rather than a normal Postgres
   * error.
   */
  const { data: schedules, error: schedulesError } = await supabase
    .from("payment_schedule")
    .select(
      `
      id,
      amount_due,
      due_date,
      policies (
        client_id,
        clients (
          full_name,
          mobile
        )
      ),
      transaction_allocations (
        amount
      )
    `
    )
    .lt("due_date", today);

  if (schedulesError) {
    return (
      <main dir="rtl" className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h1 className="text-lg font-semibold text-red-800">
              خطا در بارگذاری اطلاعات
            </h1>
            <p className="mt-2 text-sm text-red-700">
              خطا در بارگذاری برنامه‌های پرداخت: {schedulesError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const typedSchedules = (schedules ?? []) as unknown as ScheduleWithPolicy[];

  const debtorMap = new Map<string, Debtor>();

  for (const schedule of typedSchedules) {
    const policy = Array.isArray(schedule.policies)
      ? schedule.policies[0]
      : schedule.policies;

    if (!policy) {
      continue;
    }

    const client = Array.isArray(policy.clients)
      ? policy.clients[0]
      : policy.clients;

    if (!client) {
      continue;
    }

    const allocations = Array.isArray(schedule.transaction_allocations)
      ? schedule.transaction_allocations
      : schedule.transaction_allocations
        ? [schedule.transaction_allocations]
        : [];

    const amountDue = Number(schedule.amount_due || 0);
    const amountPaid = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount || 0),
      0
    );
    const remaining = Math.max(amountDue - amountPaid, 0);

    // Fully paid overdue installments are not debt.
    if (remaining <= 0) {
      continue;
    }

    const existing = debtorMap.get(policy.client_id);

    if (existing) {
      existing.totalDebt += remaining;
      existing.overdueInstallments += 1;
    } else {
      debtorMap.set(policy.client_id, {
        clientId: policy.client_id,
        clientName: client.full_name || "نامشخص",
        mobile: client.mobile,
        totalDebt: remaining,
        overdueInstallments: 1,
      });
    }
  }

  const debtors = Array.from(debtorMap.values()).sort(
    (a, b) => b.totalDebt - a.totalDebt
  );

  const totalDebt = debtors.reduce((sum, debtor) => sum + debtor.totalDebt, 0);

  return <DebtorsClient debtors={debtors} totalDebt={totalDebt} />;
}