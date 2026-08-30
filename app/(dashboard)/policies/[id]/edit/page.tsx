import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import EditPolicyForm from "./EditPolicyForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPolicyPage({
  params,
}: PageProps) {
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

  const { data: policy, error: policyError } = await supabase
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
      client_id
    `)
    .eq("id", id)
    .single();

  if (policyError || !policy) {
    notFound();
  }

  // --------------------------------------------------
  // PAYMENT SCHEDULE
  // --------------------------------------------------

  const { data: schedule, error: scheduleError } = await supabase
    .from("payment_schedule")
    .select(`
      id,
      sequence_number,
      description,
      amount_due,
      due_date
    `)
    .eq("policy_id", id)
    .order("sequence_number", {
      ascending: true,
    });

  if (scheduleError) {
    console.error(
      "Payment schedule loading error:",
      scheduleError
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f8fafc] text-[#1a1a1a]"
    >
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">

        {/* BACK LINK */}

        <Link
          href={`/policies/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#0066CC] transition hover:text-[#0052a3]"
        >
          <span aria-hidden="true">←</span>
          بازگشت به بیمه‌نامه
        </Link>

        {/* HEADER */}

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ویرایش بیمه‌نامه
          </h1>

          <p className="mt-2 text-sm text-[#666666]">
            اطلاعات بیمه‌نامه {policy.policy_number} را ویرایش کنید.
          </p>
        </header>

        <EditPolicyForm
          policy={policy}
          schedule={schedule ?? []}
        />
      </div>
    </main>
  );
}