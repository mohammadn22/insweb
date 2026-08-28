"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EditPaymentFormProps = {
  transactionId: string;
  initialAmount: number;
  initialPaymentDate: string;
  initialPaymentMethod: string;
  initialDescription: string;
  onCancel: () => void;
  onSaved: () => void;
};

export default function EditPaymentForm({
  transactionId,
  initialAmount,
  initialPaymentDate,
  initialPaymentMethod,
  initialDescription,
  onCancel,
  onSaved,
}: EditPaymentFormProps) {
  const supabase = createClient();

  const [amount, setAmount] = useState(
    String(initialAmount)
  );

  const [paymentDate, setPaymentDate] = useState(
    initialPaymentDate
  );

  const [paymentMethod, setPaymentMethod] = useState(
    initialPaymentMethod
  );

  const [description, setDescription] = useState(
    initialDescription || ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage("مبلغ پرداخت باید بیشتر از صفر باشد.");
      return;
    }

    if (!paymentDate) {
      setMessage("لطفاً تاریخ پرداخت را انتخاب کنید.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc(
        "update_policy_payment",
        {
          p_transaction_id: transactionId,
          p_amount: numericAmount,
          p_payment_date: paymentDate,
          p_payment_method: paymentMethod,
          p_description:
            description.trim() || null,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setMessage("پرداخت با موفقیت ویرایش شد.");

      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ویرایش پرداخت انجام نشد."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 disabled:cursor-not-allowed disabled:bg-gray-100";

  const labelClass =
    "block text-sm font-medium text-gray-800";

  return (
    <section
      dir="rtl"
      className="min-h-full bg-gray-50 py-6"
    >
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">

        {/* CARD */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="border-b border-gray-200 px-6 py-6 sm:px-8">

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-600">
                ✎
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">
                  ویرایش پرداخت
                </h2>

                <p className="mt-1.5 text-sm leading-6 text-gray-500">
                  اطلاعات پرداخت ثبت‌شده را بررسی و ویرایش کنید.
                </p>
              </div>

            </div>

          </div>

          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            className="px-6 py-6 sm:px-8"
          >

            <div className="grid gap-6 md:grid-cols-2">

              {/* AMOUNT */}

              <label className={labelClass}>
                <span>
                  مبلغ پرداخت
                  <span className="mr-1 text-red-500">*</span>
                </span>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value)
                    }
                    className={`${inputClass} pl-16`}
                    placeholder="مثلاً ۵۰۰۰۰۰۰"
                    required
                    disabled={saving}
                  />

                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                    تومان
                  </span>
                </div>

                <span className="mt-1.5 block text-xs text-gray-500">
                  مبلغ پرداختی را به تومان وارد کنید.
                </span>
              </label>

              {/* PAYMENT DATE */}

              <label className={labelClass}>
                <span>
                  تاریخ پرداخت
                  <span className="mr-1 text-red-500">*</span>
                </span>

                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) =>
                    setPaymentDate(e.target.value)
                  }
                  className={inputClass}
                  required
                  disabled={saving}
                />

                <span className="mt-1.5 block text-xs text-gray-500">
                  تاریخ ثبت این پرداخت را مشخص کنید.
                </span>
              </label>

              {/* PAYMENT METHOD */}

              <label className={labelClass}>
                <span>
                  روش پرداخت
                  <span className="mr-1 text-red-500">*</span>
                </span>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className={`${inputClass} cursor-pointer`}
                  disabled={saving}
                >
                  <option value="cash">
                    نقدی
                  </option>

                  <option value="card">
                    کارت
                  </option>

                  <option value="bank_transfer">
                    انتقال بانکی
                  </option>

                  <option value="other">
                    سایر
                  </option>
                </select>

                <span className="mt-1.5 block text-xs text-gray-500">
                  روش دریافت وجه را انتخاب کنید.
                </span>
              </label>

              {/* DESCRIPTION */}

              <label className={labelClass}>
                <span>توضیحات</span>

                <input
                  type="text"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  className={inputClass}
                  placeholder="توضیحات مربوط به این پرداخت"
                  disabled={saving}
                />

                <span className="mt-1.5 block text-xs text-gray-500">
                  این بخش اختیاری است.
                </span>
              </label>

            </div>

            {/* MESSAGE */}

            {message && (
              <div
                className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                  message.includes("موفقیت")
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {message.includes("موفقیت")
                      ? "✓"
                      : "!"}
                  </span>

                  <span>{message}</span>
                </div>
              </div>
            )}

            {/* DIVIDER */}

            <div className="my-8 h-px bg-gray-200" />

            {/* ACTIONS */}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">

              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="h-12 rounded-lg border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>
      </div>
    </section>
  );
}