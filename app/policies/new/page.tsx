import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddPolicyForm from "../AddPolicyForm";

type NewPolicyPageProps = {
  searchParams: Promise<{
    renewFrom?: string;
  }>;
};

export default async function NewPolicyPage({
  searchParams,
}: NewPolicyPageProps) {
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

  const params = await searchParams;
  const renewFrom = params.renewFrom;

  // --------------------------------------------------
  // LOAD CLIENTS
  // --------------------------------------------------

  const { data: clients, error: clientsError } =
    await supabase
      .from("clients")
      .select("id, full_name, id_number")
      .order("full_name");

  if (clientsError) {
    return (
      <main
        className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8"
        dir="rtl"
      >
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                !
              </div>

              <div>
                <h2 className="font-semibold text-red-800">
                  خطا در بارگذاری اطلاعات
                </h2>

                <p className="mt-1 text-sm text-red-700">
                  فهرست مشتریان قابل بارگذاری نیست.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // LOAD PREVIOUS POLICY FOR RENEWAL
  // --------------------------------------------------

  let renewalData:
    | {
        previousPolicyId: string;
        clientId: string;
        policyType: string;
        policyNumber: string;
      }
    | undefined;

  if (renewFrom) {
    const { data: previousPolicy, error } =
      await supabase
        .from("policies")
        .select(`
          id,
          policy_number,
          policy_type,
          client_id
        `)
        .eq("id", renewFrom)
        .single();

    if (error || !previousPolicy) {
      notFound();
    }

    renewalData = {
      previousPolicyId: previousPolicy.id,
      clientId: previousPolicy.client_id,
      policyType: previousPolicy.policy_type,
      policyNumber: previousPolicy.policy_number,
    };
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main
      className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
      dir="rtl"
    >
      <div className="mx-auto max-w-6xl">

        {/* ==========================================
            BREADCRUMB / BACK
        ========================================== */}

        <div className="mb-6">
          <Link
            href="/policies"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <span aria-hidden="true">→</span>
            بازگشت به بیمه‌نامه‌ها
          </Link>
        </div>

        {/* ==========================================
            PAGE HEADER
        ========================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />

                <span className="text-sm font-medium text-blue-600">
                  مدیریت بیمه‌نامه‌ها
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {renewalData
                  ? "تمدید بیمه‌نامه"
                  : "ثبت بیمه‌نامه جدید"}
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                {renewalData
                  ? "اطلاعات بیمه‌نامه جدید را برای تمدید بیمه‌نامه قبلی وارد کنید."
                  : "اطلاعات بیمه‌نامه را وارد کنید تا یک بیمه‌نامه جدید برای مشتری ثبت شود."}
              </p>
            </div>

            {/* Renewal badge */}

            {renewalData && (
              <div className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                تمدید بیمه‌نامه
              </div>
            )}
          </div>
        </header>

        {/* ==========================================
            RENEWAL INFORMATION
        ========================================== */}

        {renewalData && (
          <section className="mb-6 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">

            <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">
                  ↻
                </div>

                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    اطلاعات بیمه‌نامه قبلی
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-600">
                    این بیمه‌نامه به عنوان تمدید بیمه‌نامه قبلی ثبت خواهد شد.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  شماره بیمه‌نامه قبلی
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {renewalData.policyNumber}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  نوع بیمه‌نامه
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {renewalData.policyType}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500">
                  وضعیت حسابداری
                </p>

                <p className="mt-2 font-semibold text-green-700">
                  حسابداری مستقل
                </p>
              </div>

            </div>

            <div className="border-t border-blue-100 bg-gray-50 px-5 py-4 sm:px-6">
              <p className="text-sm leading-6 text-gray-600">
                برنامه پرداخت و تراکنش‌های بیمه‌نامه جدید
                مستقل از بیمه‌نامه قبلی ثبت خواهد شد.
              </p>
            </div>
          </section>
        )}

        {/* ==========================================
            MAIN FORM CARD
        ========================================== */}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          {/* Card header */}

          <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
            <div className="flex items-center justify-between gap-4">

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {renewalData
                    ? "اطلاعات بیمه‌نامه جدید"
                    : "اطلاعات بیمه‌نامه"}
                </h2>

                <p className="mt-1.5 text-sm text-gray-500">
                  فیلدهای مورد نیاز را با دقت تکمیل کنید.
                </p>
              </div>

              <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-600 sm:flex">
                +
              </div>

            </div>
          </div>

          {/* Form area */}

          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <AddPolicyForm
              clients={clients ?? []}
              renewalData={renewalData}
            />
          </div>

        </section>

        {/* ==========================================
            BOTTOM HELP / NOTE
        ========================================== */}

        <div className="mt-5 flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
            i
          </div>

          <p className="text-sm leading-6 text-gray-600">
            پس از ثبت بیمه‌نامه، برنامه پرداخت آن به صورت
            مستقل ایجاد می‌شود و می‌توانید پرداخت‌ها و
            بدهی‌های مشتری را از بخش حسابداری پیگیری کنید.
          </p>
        </div>

      </div>
    </main>
  );
}