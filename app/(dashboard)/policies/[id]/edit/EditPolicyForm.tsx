"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
};

type PaymentScheduleItem = {
  id: string;
  sequence_number: number;
  description: string;
  amount_due: number;
  due_date: string;
};

type EditPolicyFormProps = {
  policy: Policy;
  schedule: PaymentScheduleItem[];
};

const POLICY_TYPES = [
  "شخص ثالث",
  "شخص ثالث موتور",
  "بدنه",
  "آتش‌سوزی",
  "مسئولیت",
  "باربری",
  "خارج از کشور",
];

export default function EditPolicyForm({
  policy,
  schedule,
}: EditPolicyFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [policyNumber, setPolicyNumber] = useState(
    policy.policy_number
  );

  const [policyType, setPolicyType] = useState(
    policy.policy_type
  );

  const [startDate, setStartDate] = useState(
    policy.start_date
  );

  const [endDate, setEndDate] = useState(
    policy.end_date
  );

  const [totalPrice, setTotalPrice] = useState(
    String(policy.total_price)
  );

  const [initialPaymentRequired, setInitialPaymentRequired] =
    useState(String(policy.initial_payment_required));

  const [installmentCount, setInstallmentCount] = useState(
    String(policy.installment_count)
  );

  const [firstInstallmentOffsetDays, setFirstInstallmentOffsetDays] =
    useState(
      String(policy.first_installment_offset_days ?? 0)
    );

  const [installmentIntervalDays, setInstallmentIntervalDays] =
    useState(
      String(policy.installment_interval_days ?? 30)
    );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const hasPayments =
    schedule.length > 0;

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    if (!policyNumber.trim()) {
      setMessage("شماره بیمه‌نامه الزامی است.");
      return;
    }

    if (!policyType) {
      setMessage("نوع بیمه‌نامه را انتخاب کنید.");
      return;
    }

    if (!startDate || !endDate) {
      setMessage("تاریخ شروع و پایان الزامی است.");
      return;
    }

    const numericTotalPrice = Number(totalPrice);
    const numericInitialPayment = Number(
      initialPaymentRequired
    );
    const numericInstallmentCount = Number(
      installmentCount
    );
    const numericOffset = Number(
      firstInstallmentOffsetDays
    );
    const numericInterval = Number(
      installmentIntervalDays
    );

    if (
      !Number.isFinite(numericTotalPrice) ||
      numericTotalPrice <= 0
    ) {
      setMessage("مبلغ کل باید بیشتر از صفر باشد.");
      return;
    }

    if (
      !Number.isFinite(numericInitialPayment) ||
      numericInitialPayment < 0
    ) {
      setMessage("مبلغ پیش‌پرداخت معتبر نیست.");
      return;
    }

    if (
      numericInitialPayment > numericTotalPrice
    ) {
      setMessage(
        "مبلغ پیش‌پرداخت نمی‌تواند بیشتر از مبلغ کل بیمه‌نامه باشد."
      );
      return;
    }

    if (
      !Number.isInteger(numericInstallmentCount) ||
      numericInstallmentCount < 0
    ) {
      setMessage(
        "تعداد اقساط باید یک عدد صحیح صفر یا بیشتر باشد."
      );
      return;
    }

    if (
      numericInstallmentCount > 0 &&
      (
        !Number.isFinite(numericOffset) ||
        numericOffset < 0
      )
    ) {
      setMessage(
        "فاصله اولین قسط باید صفر یا بیشتر باشد."
      );
      return;
    }

    if (
      numericInstallmentCount > 0 &&
      (
        !Number.isFinite(numericInterval) ||
        numericInterval <= 0
      )
    ) {
      setMessage(
        "فاصله بین اقساط باید بیشتر از صفر باشد."
      );
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setMessage(
        "تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد."
      );
      return;
    }

    /*
     * IMPORTANT
     *
     * If this policy already has a payment schedule,
     * changing financial fields such as total price,
     * initial payment or installment count can affect
     * existing payment allocations.
     *
     * Therefore we update the policy itself here, but
     * we do NOT automatically destroy/rebuild the schedule.
     */

    setSaving(true);

    try {
      const { error } = await supabase
        .from("policies")
        .update({
          policy_number: policyNumber.trim(),
          policy_type: policyType,
          start_date: startDate,
          end_date: endDate,
          total_price: numericTotalPrice,
          initial_payment_required:
            numericInitialPayment,
          installment_count:
            numericInstallmentCount,
          first_installment_offset_days:
            numericOffset,
          installment_interval_days:
            numericInterval,
        })
        .eq("id", policy.id);

      if (error) {
        throw new Error(error.message);
      }

      router.replace(`/policies/${policy.id}`);
      router.refresh();
    } catch (error) {
      console.error(
        "Policy update error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "ویرایش بیمه‌نامه انجام نشد."
      );

      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:bg-gray-100";

  const labelClass =
    "block text-sm font-medium text-gray-800";

  return (
    <form onSubmit={handleSubmit}>

      {/* --------------------------------------------------
          POLICY INFORMATION
      -------------------------------------------------- */}

      <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        <div className="border-b border-gray-200 px-6 py-6 sm:px-8">
          <h2 className="text-xl font-bold">
            اطلاعات بیمه‌نامه
          </h2>

          <p className="mt-1.5 text-sm text-gray-500">
            اطلاعات اصلی بیمه‌نامه را ویرایش کنید.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 md:grid-cols-2">

          {/* POLICY NUMBER */}

          <label className={labelClass}>
            شماره بیمه‌نامه
            <span className="mr-1 text-red-500">*</span>

            <input
              type="text"
              value={policyNumber}
              onChange={(e) =>
                setPolicyNumber(e.target.value)
              }
              className={inputClass}
              disabled={saving}
              required
            />
          </label>

          {/* POLICY TYPE */}

          <label className={labelClass}>
            نوع بیمه‌نامه
            <span className="mr-1 text-red-500">*</span>

            <select
              value={policyType}
              onChange={(e) =>
                setPolicyType(e.target.value)
              }
              className={`${inputClass} cursor-pointer`}
              disabled={saving}
              required
            >
              <option value="">
                انتخاب نوع بیمه‌نامه
              </option>

              {POLICY_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </label>

          {/* START DATE */}

          <label className={labelClass}>
            تاریخ شروع
            <span className="mr-1 text-red-500">*</span>

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
              className={inputClass}
              disabled={saving}
              required
            />
          </label>

          {/* END DATE */}

          <label className={labelClass}>
            تاریخ پایان
            <span className="mr-1 text-red-500">*</span>

            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(e.target.value)
              }
              className={inputClass}
              disabled={saving}
              required
            />
          </label>

        </div>
      </section>

      {/* --------------------------------------------------
          FINANCIAL INFORMATION
      -------------------------------------------------- */}

      <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        <div className="border-b border-gray-200 px-6 py-6 sm:px-8">
          <h2 className="text-xl font-bold">
            اطلاعات مالی
          </h2>

          <p className="mt-1.5 text-sm text-gray-500">
            مبلغ بیمه‌نامه و نحوه پرداخت را ویرایش کنید.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 md:grid-cols-2">

          {/* TOTAL */}

          <label className={labelClass}>
            مبلغ کل بیمه‌نامه
            <span className="mr-1 text-red-500">*</span>

            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={totalPrice}
                onChange={(e) =>
                  setTotalPrice(e.target.value)
                }
                className={`${inputClass} pl-16`}
                disabled={saving}
                required
              />

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                تومان
              </span>
            </div>
          </label>

          {/* INITIAL PAYMENT */}

          <label className={labelClass}>
            مبلغ پیش‌پرداخت

            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={initialPaymentRequired}
                onChange={(e) =>
                  setInitialPaymentRequired(
                    e.target.value
                  )
                }
                className={`${inputClass} pl-16`}
                disabled={saving}
              />

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                تومان
              </span>
            </div>
          </label>

          {/* INSTALLMENT COUNT */}

          <label className={labelClass}>
            تعداد اقساط

            <input
              type="number"
              min="0"
              step="1"
              value={installmentCount}
              onChange={(e) =>
                setInstallmentCount(e.target.value)
              }
              className={inputClass}
              disabled={saving}
            />
          </label>

          {/* FIRST INSTALLMENT OFFSET */}

          <label className={labelClass}>
            فاصله اولین قسط

            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={firstInstallmentOffsetDays}
                onChange={(e) =>
                  setFirstInstallmentOffsetDays(
                    e.target.value
                  )
                }
                className={`${inputClass} pl-16`}
                disabled={
                  saving ||
                  numericInstallmentsDisabled(
                    installmentCount
                  )
                }
              />

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                روز
              </span>
            </div>

            <span className="mt-1.5 block text-xs text-gray-500">
              فاصله اولین قسط از تاریخ شروع بیمه‌نامه.
            </span>
          </label>

          {/* INSTALLMENT INTERVAL */}

          <label className={labelClass}>
            فاصله بین اقساط

            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={installmentIntervalDays}
                onChange={(e) =>
                  setInstallmentIntervalDays(
                    e.target.value
                  )
                }
                className={`${inputClass} pl-16`}
                disabled={
                  saving ||
                  numericInstallmentsDisabled(
                    installmentCount
                  )
                }
              />

              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                روز
              </span>
            </div>

            <span className="mt-1.5 block text-xs text-gray-500">
              فاصله زمانی بین سررسید اقساط.
            </span>
          </label>

        </div>
      </section>

      {/* --------------------------------------------------
          EXISTING PAYMENT SCHEDULE WARNING
      -------------------------------------------------- */}

      {hasPayments && (
        <section className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-5">

          <div className="flex gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700">
              !
            </div>

            <div>
              <h3 className="font-bold text-orange-900">
                این بیمه‌نامه دارای برنامه پرداخت است
              </h3>

              <p className="mt-1 text-sm leading-6 text-orange-800">
                تغییر اطلاعات مالی بالا فقط اطلاعات خود
                بیمه‌نامه را تغییر می‌دهد و برنامه پرداخت
                موجود را به‌صورت خودکار حذف یا بازسازی
                نمی‌کند.
              </p>

              <p className="mt-2 text-sm leading-6 text-orange-800">
                این کار برای جلوگیری از خراب شدن تخصیص
                پرداخت‌های ثبت‌شده انجام شده است.
              </p>
            </div>

          </div>
        </section>
      )}

      {/* --------------------------------------------------
          ERROR
      -------------------------------------------------- */}

      {message && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <span className="font-bold">!</span>
            <span>{message}</span>
          </div>
        </div>
      )}

      {/* --------------------------------------------------
          ACTIONS
      -------------------------------------------------- */}

      <div className="mb-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">

        <button
          type="button"
          onClick={() =>
            router.push(`/policies/${policy.id}`)
          }
          disabled={saving}
          className="h-12 rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          انصراف
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0066CC] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0052a3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              در حال ذخیره...
            </>
          ) : (
            <>
              <span>✓</span>
              ذخیره تغییرات
            </>
          )}
        </button>

      </div>
    </form>
  );
}

function numericInstallmentsDisabled(
  value: string
) {
  const count = Number(value);

  return !Number.isFinite(count) || count <= 0;
}