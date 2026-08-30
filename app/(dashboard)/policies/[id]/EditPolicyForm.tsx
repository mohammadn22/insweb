"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const POLICY_TYPES = [
  "بیمه شخص ثالث خودرو",
  "بیمه شخص ثالث موتورسیکلت",
  "بیمه شخص ثالث سایر",
  "بیمه آتش‌سوزی",
  "بیمه مسئولیت",
  "بیمه بدنه خودرو",
  "بیمه حمل و نقل بار",
];

type EditPolicyFormProps = {
  policyId: string;
  initialPolicyNumber: string;
  initialPolicyType: string;
  initialStartDate: string;
  initialEndDate: string;
  initialTotalPrice: number;
  initialPaymentRequired: number;
  initialInstallmentCount: number;
  initialFirstOffset: number | null;
  initialInterval: number | null;
  hasTransactions: boolean;
  onCancel: () => void;
};

export default function EditPolicyForm({
  policyId,
  initialPolicyNumber,
  initialPolicyType,
  initialStartDate,
  initialEndDate,
  initialTotalPrice,
  initialPaymentRequired,
  initialInstallmentCount,
  initialFirstOffset,
  initialInterval,
  hasTransactions,
  onCancel,
}: EditPolicyFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [policyNumber, setPolicyNumber] = useState(initialPolicyNumber);
  const [policyType, setPolicyType] = useState(initialPolicyType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [totalPrice, setTotalPrice] = useState(String(initialTotalPrice));
  const [initialPaymentRequired, setInitialPaymentRequired] = useState(
    String(initialPaymentRequired)
  );
  const [installmentCount, setInstallmentCount] = useState(
    String(initialInstallmentCount)
  );
  const [firstOffset, setFirstOffset] = useState(String(initialFirstOffset ?? 40));
  const [interval, setInterval] = useState(String(initialInterval ?? 30));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const total = Number(totalPrice);
    const initialRequired = Number(initialPaymentRequired);
    const installments = Number(installmentCount);
    const offset = Number(firstOffset);
    const intervalDays = Number(interval);

    if (!policyNumber.trim()) {
      setMessage("لطفاً شماره بیمه‌نامه را وارد کنید.");
      return;
    }

    if (!startDate || !endDate || endDate <= startDate) {
      setMessage("تاریخ پایان باید بعد از تاریخ شروع باشد.");
      return;
    }

    if (!Number.isFinite(total) || total <= 0) {
      setMessage("مجموع مبلغ بیمه‌نامه باید بیشتر از صفر باشد.");
      return;
    }

    if (!Number.isFinite(initialRequired) || initialRequired < 0 || initialRequired > total) {
      setMessage("مبلغ پرداخت اولیه باید بین صفر و مبلغ کل باشد.");
      return;
    }

    if (!Number.isInteger(installments) || installments < 0) {
      setMessage("تعداد اقساط نامعتبر است.");
      return;
    }

    if (installments === 0 && initialRequired < total) {
      setMessage("برای مبلغ باقی‌مانده باید حداقل یک قسط تعریف کنید.");
      return;
    }

    if (installments > 0 && (offset < 0 || interval <= 0)) {
      setMessage("فاصله اولین قسط و فاصله بین اقساط باید معتبر باشد.");
      return;
    }

    if (hasTransactions) {
      // Existing transactions must not be invalidated by changing their schedule.
      if (
        installments !== initialInstallmentCount ||
        initialRequired !== initialPaymentRequired ||
        offset !== (initialFirstOffset ?? 40) ||
        intervalDays !== (initialInterval ?? 30)
      ) {
        setMessage(
          "این بیمه‌نامه تراکنش ثبت‌شده دارد؛ برای حفظ سوابق مالی، تغییر برنامه پرداخت مجاز نیست."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("policies")
        .update({
          policy_number: policyNumber.trim(),
          policy_type: policyType,
          start_date: startDate,
          end_date: endDate,
          total_price: total,
          initial_payment_required: initialRequired,
          installment_count: installments,
          first_installment_offset_days: installments > 0 ? offset : null,
          installment_interval_days: installments > 0 ? intervalDays : null,
        })
        .eq("id", policyId);

      if (error) {
        throw new Error(error.message);
      }

      setMessage("اطلاعات بیمه‌نامه با موفقیت ویرایش شد.");
      router.refresh();
      onCancel();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ویرایش بیمه‌نامه انجام نشد."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:bg-gray-100";

  return (
    <section dir="rtl" className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold">ویرایش بیمه‌نامه</h2>
        <p className="mt-1 text-sm text-gray-600">
          اطلاعات بیمه‌نامه را اصلاح کنید و سپس ذخیره را بزنید.
        </p>
      </div>

      {hasTransactions && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          این بیمه‌نامه تراکنش دارد. اطلاعات اصلی قابل ویرایش است، اما تغییر برنامه پرداخت برای جلوگیری از مغایرت با سوابق مالی غیرفعال است.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold">
            شماره بیمه‌نامه
            <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className={`${inputClass} mt-2`} disabled={saving} />
          </label>

          <label className="text-sm font-semibold">
            نوع بیمه‌نامه
            <select value={policyType} onChange={(e) => setPolicyType(e.target.value)} className={`${inputClass} mt-2`} disabled={saving}>
              {POLICY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>

          <label className="text-sm font-semibold">
            مبلغ کل
            <input type="number" min="1" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className={`${inputClass} mt-2`} disabled={saving} />
          </label>

          <label className="text-sm font-semibold">
            تاریخ شروع
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} mt-2`} disabled={saving} />
          </label>

          <label className="text-sm font-semibold">
            تاریخ پایان
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} mt-2`} disabled={saving} />
          </label>

          <label className="text-sm font-semibold">
            مبلغ پرداخت اولیه
            <input type="number" min="0" value={initialPaymentRequired} onChange={(e) => setInitialPaymentRequired(e.target.value)} className={`${inputClass} mt-2`} disabled={saving || hasTransactions} />
          </label>

          <label className="text-sm font-semibold">
            تعداد اقساط
            <input type="number" min="0" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} className={`${inputClass} mt-2`} disabled={saving || hasTransactions} />
          </label>

          <label className="text-sm font-semibold">
            فاصله اولین قسط (روز)
            <input type="number" min="0" value={firstOffset} onChange={(e) => setFirstOffset(e.target.value)} className={`${inputClass} mt-2`} disabled={saving || hasTransactions || Number(installmentCount) === 0} />
          </label>

          <label className="text-sm font-semibold">
            فاصله اقساط (روز)
            <input type="number" min="1" value={interval} onChange={(e) => setInterval(e.target.value)} className={`${inputClass} mt-2`} disabled={saving || hasTransactions || Number(installmentCount) === 0} />
          </label>
        </div>

        {message && (
          <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${message.includes("موفقیت") ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="h-11 rounded-lg bg-[#0066CC] px-5 text-sm font-semibold text-white transition hover:bg-[#0052a3] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="h-11 rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            انصراف
          </button>
        </div>
      </form>
    </section>
  );
}
