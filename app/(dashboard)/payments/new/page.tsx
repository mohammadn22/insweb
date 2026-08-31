import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import RecordPaymentForm from "../../policies/[id]/RecordPaymentForm";

type NewPaymentPageProps = {
  searchParams: Promise<{
    policyId?: string;
  }>;
};

export default async function NewPaymentPage({
  searchParams,
}: NewPaymentPageProps) {
  const supabase = await createClient();

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // --------------------------------------------------
  // GET POLICY ID
  // --------------------------------------------------

  const params = await searchParams;
  const policyId = params.policyId;

  if (!policyId) {
    redirect("/policies");
  }

  // --------------------------------------------------
  // LOAD POLICY
  // --------------------------------------------------

  const { data: policy, error } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      client_id,
      clients (
        full_name
      )
    `)
    .eq("id", policyId)
    .single();

  if (error || !policy) {
    notFound();
  }

  const client = Array.isArray(policy.clients)
    ? policy.clients[0]
    : policy.clients;

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#f8fafc] text-[#1a1a1a]"
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">

        {/* BACK */}
        <Link
          href={`/policies/${policy.id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#0066CC] transition-colors hover:text-[#0052a3]"
        >
          <span aria-hidden="true">←</span>
          بازگشت به بیمه‌نامه
        </Link>

        {/* HEADER */}
        <header className="mb-8">
          <div className="mb-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0066CC]">
              ثبت پرداخت
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ثبت پرداخت جدید
          </h1>

          <div className="mt-3 text-sm text-[#666666]">
            <p>
              بیمه‌نامه:{" "}
              <span className="font-semibold text-gray-900">
                {policy.policy_number}
              </span>
            </p>

            {client && (
              <p className="mt-1">
                مشتری:{" "}
                <span className="font-semibold text-gray-900">
                  {client.full_name}
                </span>
              </p>
            )}
          </div>
        </header>

        {/* FORM */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-6">
          <RecordPaymentForm policyId={policy.id} />
        </section>

      </div>
    </main>
  );
}