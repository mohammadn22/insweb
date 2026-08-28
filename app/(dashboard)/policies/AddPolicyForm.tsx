"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
  id_number: string;
};

type RenewalData = {
  previousPolicyId: string;
  clientId: string;
  policyType: string;
  policyNumber?: string;
};

const POLICY_TYPES = [
  "بیمه شخص ثالث خودرو",
  "بیمه شخص ثالث موتورسیکلت",
  "بیمه شخص ثالث سایر",
  "بیمه آتش‌سوزی",
  "بیمه مسئولیت",
  "بیمه بدنه خودرو",
  "بیمه حمل و نقل بار",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().split("T")[0];
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

export default function AddPolicyForm({
  clients: initialClients,
  renewalData,
}: {
  clients?: Client[];
  renewalData?: RenewalData;
}) {
  const supabase = createClient();

  /*
   * --------------------------------------------------
   * SAFE CLIENT DATA
   * --------------------------------------------------
   */

  const clients = Array.isArray(initialClients)
    ? initialClients
    : [];

  /*
   * --------------------------------------------------
   * STATE
   * --------------------------------------------------
   */

  const [clientSearch, setClientSearch] = useState("");

  const [selectedClient, setSelectedClient] =
    useState<Client | null>(() => {
      if (!renewalData) return null;

      return (
        clients.find(
          (client) =>
            client.id === renewalData.clientId
        ) || null
      );
    });

  const [policyNumber, setPolicyNumber] =
    useState("");

  const [policyType, setPolicyType] = useState(
    renewalData?.policyType &&
      POLICY_TYPES.includes(renewalData.policyType)
      ? renewalData.policyType
      : POLICY_TYPES[0]
  );

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [totalPrice, setTotalPrice] =
    useState("");

  const [initialPaymentRequired, setInitialPaymentRequired] =
    useState("");

  const [actualPaidToday, setActualPaidToday] =
    useState("");

  const [installmentCount, setInstallmentCount] =
    useState("0");

  const [firstInstallmentOffset, setFirstInstallmentOffset] =
    useState("40");

  const [installmentInterval, setInstallmentInterval] =
    useState("30");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  /*
   * --------------------------------------------------
   * CALCULATED VALUES
   * --------------------------------------------------
   */

  const total = Number(totalPrice) || 0;

  const initialRequired =
    Number(initialPaymentRequired) || 0;

  const paidToday =
    Number(actualPaidToday) || 0;

  const numberOfInstallments =
    Number(installmentCount) || 0;

  const firstOffset =
    Number(firstInstallmentOffset) || 0;

  const interval =
    Number(installmentInterval) || 0;

  const remainingAmount = Math.max(
    total - initialRequired,
    0
  );

  const installmentAmount =
    numberOfInstallments > 0
      ? remainingAmount / numberOfInstallments
      : 0;

  const upfrontDebt = Math.max(
    initialRequired - paidToday,
    0
  );

  const totalScheduled =
    initialRequired +
    installmentAmount * numberOfInstallments;

  const hasPaymentPlanMismatch =
    total > 0 &&
    Math.abs(totalScheduled - total) > 0.01;

  /*
   * --------------------------------------------------
   * CLIENT SEARCH
   * --------------------------------------------------
   */

  const filteredClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();

    if (!search) {
      return [];
    }

    return clients
      .filter(
        (client) =>
          client.full_name
            .toLowerCase()
            .includes(search) ||
          client.id_number.includes(search)
      )
      .slice(0, 10);
  }, [clients, clientSearch]);

  /*
   * --------------------------------------------------
   * PAYMENT SCHEDULE
   * --------------------------------------------------
   */

  const schedule = useMemo(() => {
    if (
      !startDate ||
      numberOfInstallments <= 0 ||
      installmentAmount <= 0
    ) {
      return [];
    }

    return Array.from(
      { length: numberOfInstallments },
      (_, index) => {
        const sequence = index + 1;

        const days =
          firstOffset +
          index * interval;

        return {
          sequence,
          amount: installmentAmount,
          dueDate: addDays(startDate, days),
        };
      }
    );
  }, [
    startDate,
    numberOfInstallments,
    installmentAmount,
    firstOffset,
    interval,
  ]);

  /*
   * --------------------------------------------------
   * SUBMIT
   * --------------------------------------------------
   */

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!selectedClient) {
      setMessage("لطفاً یک مشتری انتخاب کنید.");
      setMessageType("error");
      return;
    }

    if (!policyNumber.trim()) {
      setMessage("لطفاً شماره بیمه‌نامه را وارد کنید.");
      setMessageType("error");
      return;
    }

    if (!startDate || !endDate) {
      setMessage(
        "لطفاً تاریخ شروع و پایان بیمه‌نامه را وارد کنید."
      );
      setMessageType("error");
      return;
    }

    if (endDate <= startDate) {
      setMessage(
        "تاریخ پایان باید بعد از تاریخ شروع باشد."
      );
      setMessageType("error");
      return;
    }

    if (total <= 0) {
      setMessage(
        "مجموع مبلغ بیمه‌نامه باید بیشتر از صفر باشد."
      );
      setMessageType("error");
      return;
    }

    if (initialRequired < 0) {
      setMessage(
        "مبلغ پرداخت اولیه نمی‌تواند منفی باشد."
      );
      setMessageType("error");
      return;
    }

    if (initialRequired > total) {
      setMessage(
        "مبلغ پرداخت اولیه نمی‌تواند از مبلغ کل بیمه‌نامه بیشتر باشد."
      );
      setMessageType("error");
      return;
    }

    if (
      paidToday < 0 ||
      paidToday > initialRequired
    ) {
      setMessage(
        "مبلغ پرداخت‌شده امروز نمی‌تواند بیشتر از مبلغ پرداخت اولیه باشد."
      );
      setMessageType("error");
      return;
    }

    if (numberOfInstallments < 0) {
      setMessage(
        "تعداد اقساط نمی‌تواند منفی باشد."
      );
      setMessageType("error");
      return;
    }

    if (numberOfInstallments > 0) {
      if (firstOffset < 0) {
        setMessage(
          "فاصله سررسید اولین قسط نمی‌تواند منفی باشد."
        );
        setMessageType("error");
        return;
      }

      if (interval <= 0) {
        setMessage(
          "فاصله بین اقساط باید بیشتر از صفر روز باشد."
        );
        setMessageType("error");
        return;
      }
    }

    /*
     * Prevent an incomplete payment plan.
     */

    if (numberOfInstallments === 0 && initialRequired < total) {
      setMessage(
        "برای مبلغ باقی‌مانده باید حداقل یک قسط تعریف کنید یا مبلغ پرداخت اولیه را برابر با مبلغ کل قرار دهید."
      );
      setMessageType("error");
      return;
    }

    setSaving(true);

    try {
      /*
       * --------------------------------------------------
       * CREATE POLICY
       * --------------------------------------------------
       */

      const {
        data: policy,
        error: policyError,
      } = await supabase
        .from("policies")
        .insert({
          client_id: selectedClient.id,

          previous_policy_id:
            renewalData?.previousPolicyId || null,

          policy_number:
            policyNumber.trim(),

          policy_type: policyType,

          start_date: startDate,

          end_date: endDate,

          total_price: total,

          initial_payment_required:
            initialRequired,

          installment_count:
            numberOfInstallments,

          first_installment_offset_days:
            numberOfInstallments > 0
              ? firstOffset
              : null,

          installment_interval_days:
            numberOfInstallments > 0
              ? interval
              : null,
        })
        .select()
        .single();

      if (policyError || !policy) {
        throw new Error(
          policyError?.message ||
            "ایجاد بیمه‌نامه انجام نشد."
        );
      }

      /*
       * --------------------------------------------------
       * CREATE PAYMENT SCHEDULE
       * --------------------------------------------------
       */

      const scheduleRows = [
        {
          policy_id: policy.id,
          sequence_number: 0,
          description: "پرداخت اولیه",
          amount_due: initialRequired,
          due_date: startDate,
        },

        ...schedule.map((item) => ({
          policy_id: policy.id,
          sequence_number: item.sequence,
          description: `قسط ${item.sequence}`,
          amount_due: item.amount,
          due_date: item.dueDate,
        })),
      ].filter(
        (item) => item.amount_due > 0
      );

      if (scheduleRows.length > 0) {
        const {
          error: scheduleError,
        } = await supabase
          .from("payment_schedule")
          .insert(scheduleRows);

        if (scheduleError) {
          throw new Error(
            scheduleError.message
          );
        }
      }

      /*
       * --------------------------------------------------
       * RECORD ACTUAL PAYMENT
       * --------------------------------------------------
       */

      if (paidToday > 0) {
        const {
          data: transaction,
          error: transactionError,
        } = await supabase
          .from("transactions")
          .insert({
            client_id: selectedClient.id,
            policy_id: policy.id,
            amount: paidToday,

            payment_date: new Date()
              .toISOString()
              .split("T")[0],

            payment_method: "cash",

            description:
              "پرداخت اولیه",
          })
          .select()
          .single();

        if (
          transactionError ||
          !transaction
        ) {
          throw new Error(
            transactionError?.message ||
              "ثبت پرداخت اولیه انجام نشد."
          );
        }

        /*
         * --------------------------------------------------
         * ALLOCATE PAYMENT
         * --------------------------------------------------
         */

        if (initialRequired > 0) {
          const {
            data: upfrontSchedule,
            error: upfrontScheduleError,
          } = await supabase
            .from("payment_schedule")
            .select("id")
            .eq("policy_id", policy.id)
            .eq("sequence_number", 0)
            .single();

          if (upfrontScheduleError) {
            throw new Error(
              upfrontScheduleError.message
            );
          }

          if (upfrontSchedule) {
            const {
              error: allocationError,
            } = await supabase
              .from("transaction_allocations")
              .insert({
                transaction_id:
                  transaction.id,

                payment_schedule_id:
                  upfrontSchedule.id,

                amount: paidToday,
              });

            if (allocationError) {
              throw new Error(
                allocationError.message
              );
            }
          }
        }
      }

      setMessage(
        "بیمه‌نامه با موفقیت ایجاد شد."
      );

      setMessageType("success");

      /*
       * Reset form
       */

      setSelectedClient(null);
      setClientSearch("");
      setPolicyNumber("");
      setPolicyType(POLICY_TYPES[0]);
      setStartDate("");
      setEndDate("");
      setTotalPrice("");
      setInitialPaymentRequired("");
      setActualPaidToday("");
      setInstallmentCount("0");
      setFirstInstallmentOffset("40");
      setInstallmentInterval("30");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "خطای غیرمنتظره‌ای رخ داد."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * SHARED STYLES
   * --------------------------------------------------
   */

  const inputClass =
    "h-12 w-full rounded-md border border-[#D0D0D0] bg-white px-4 text-[15px] text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10";

  const selectClass =
    "h-12 w-full rounded-md border border-[#D0D0D0] bg-white px-4 text-[15px] text-gray-900 outline-none transition hover:border-gray-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10";

  const labelClass =
    "mb-2 block text-sm font-semibold text-gray-800";

  const helpClass =
    "mt-2 text-xs leading-5 text-gray-500";

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      className="mx-auto w-full max-w-[1200px] pb-12"
    >
      {/* ==================================================
          PAGE INTRO
      ================================================== */}

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <span>بیمه‌نامه‌ها</span>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">
            {renewalData
              ? "تمدید بیمه‌نامه"
              : "بیمه‌نامه جدید"}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
              {renewalData
                ? "تمدید بیمه‌نامه"
                : "افزودن بیمه‌نامه"}
            </h1>

            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-gray-500">
              {renewalData
                ? "اطلاعات بیمه‌نامه جدید را بر اساس بیمه‌نامه قبلی ثبت کنید."
                : "اطلاعات بیمه‌نامه، مشتری و برنامه پرداخت را وارد کنید."}
            </p>
          </div>

          {renewalData && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              <span className="text-sm">↻</span>
              بیمه‌نامه تمدیدی
            </span>
          )}
        </div>
      </div>

      {/* ==================================================
          RENEWAL NOTICE
      ================================================== */}

      {renewalData && (
        <section className="mb-6 overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
          <div className="flex items-start gap-4 p-5 sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
              ↻
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold text-blue-950">
                تمدید بیمه‌نامه قبلی
              </h2>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                این بیمه‌نامه به عنوان یک بیمه‌نامه جدید
                ثبت می‌شود و برنامه پرداخت و سوابق مالی
                مستقل خود را خواهد داشت.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="rounded-md border border-blue-200 bg-white px-4 py-2.5">
                  <p className="text-xs text-gray-500">
                    بیمه‌نامه قبلی
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {renewalData.policyNumber ||
                      renewalData.previousPolicyId}
                  </p>
                </div>

                <div className="rounded-md border border-blue-200 bg-white px-4 py-2.5">
                  <p className="text-xs text-gray-500">
                    نوع بیمه
                  </p>

                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {renewalData.policyType}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================
          CLIENT
      ================================================== */}

      <section className="mb-6 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
        <div className="border-b border-[#E0E0E0] bg-[#F5F5F5] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              ۱
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-950">
                انتخاب مشتری
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                مشتری صاحب این بیمه‌نامه را انتخاب کنید.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {renewalData ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-700">
                    مشتری بیمه‌نامه
                  </p>

                  <p className="mt-1 text-lg font-bold text-gray-950">
                    {selectedClient?.full_name ||
                      "مشتری پیدا نشد"}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    کد ملی:{" "}
                    {selectedClient?.id_number || "-"}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  تمدید
                </span>
              </div>
            </div>
          ) : selectedClient ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-green-700">
                    مشتری انتخاب‌شده
                  </p>

                  <p className="mt-1 text-lg font-bold text-gray-950">
                    {selectedClient.full_name}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    کد ملی: {selectedClient.id_number}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch("");
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  تغییر مشتری
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="client-search"
                className={labelClass}
              >
                جستجوی مشتری
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  ⌕
                </span>

                <input
                  id="client-search"
                  type="text"
                  value={clientSearch}
                  onChange={(e) =>
                    setClientSearch(e.target.value)
                  }
                  placeholder="نام یا کد ملی مشتری را وارد کنید"
                  className={`${inputClass} pr-11`}
                />
              </div>

              <p className={helpClass}>
                با وارد کردن نام یا کد ملی، مشتری موردنظر را
                از فهرست انتخاب کنید.
              </p>

              {clientSearch.trim() &&
                filteredClients.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-md border border-[#E0E0E0] bg-white shadow-sm">
                    {filteredClients.map(
                      (client, index) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch(
                              client.full_name
                            );
                          }}
                          className={`flex w-full items-center justify-between gap-4 px-4 py-3.5 text-right transition hover:bg-gray-50 ${
                            index !==
                            filteredClients.length - 1
                              ? "border-b border-gray-100"
                              : ""
                          }`}
                        >
                          <span className="font-semibold text-gray-900">
                            {client.full_name}
                          </span>

                          <span className="text-sm text-gray-500">
                            {client.id_number}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}

              {clientSearch.trim() &&
                filteredClients.length === 0 && (
                  <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    مشتری‌ای با این مشخصات پیدا نشد.
                  </div>
                )}
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          POLICY INFORMATION
      ================================================== */}

      <section className="mb-6 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
        <div className="border-b border-[#E0E0E0] bg-[#F5F5F5] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              ۲
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-950">
                اطلاعات بیمه‌نامه
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                اطلاعات اصلی و مدت اعتبار بیمه‌نامه را وارد
                کنید.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="policy-number"
              className={labelClass}
            >
              شماره بیمه‌نامه
            </label>

            <input
              id="policy-number"
              type="text"
              value={policyNumber}
              onChange={(e) =>
                setPolicyNumber(e.target.value)
              }
              placeholder="مثلاً ۱۲۳۴۵۶۷۸"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label
              htmlFor="policy-type"
              className={labelClass}
            >
              نوع بیمه‌نامه
            </label>

            <select
              id="policy-type"
              value={policyType}
              onChange={(e) =>
                setPolicyType(e.target.value)
              }
              className={selectClass}
            >
              {POLICY_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="start-date"
              className={labelClass}
            >
              تاریخ شروع
            </label>

            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
              className={inputClass}
              required
            />

            <p className={helpClass}>
              تاریخ آغاز اعتبار بیمه‌نامه.
            </p>
          </div>

          <div>
            <label
              htmlFor="end-date"
              className={labelClass}
            >
              تاریخ پایان
            </label>

            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(e.target.value)
              }
              className={inputClass}
              required
            />

            <p className={helpClass}>
              تاریخ پایان اعتبار بیمه‌نامه.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================
          PAYMENT SETTINGS
      ================================================== */}

      <section className="mb-6 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
        <div className="border-b border-[#E0E0E0] bg-[#F5F5F5] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              ۳
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-950">
                تنظیمات پرداخت
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                مبلغ بیمه‌نامه و نحوه پرداخت آن را مشخص کنید.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          {/* TOTAL PRICE */}

          <div>
            <label
              htmlFor="total-price"
              className={labelClass}
            >
              مبلغ کل بیمه‌نامه
            </label>

            <div className="relative">
              <input
                id="total-price"
                type="number"
                min="0"
                value={totalPrice}
                onChange={(e) =>
                  setTotalPrice(e.target.value)
                }
                placeholder="مبلغ کل را وارد کنید"
                className={`${inputClass} pl-16`}
                required
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                ریال
              </span>
            </div>
          </div>

          {/* INITIAL PAYMENT */}

          <div>
            <label
              htmlFor="initial-payment"
              className={labelClass}
            >
              مبلغ پرداخت اولیه
            </label>

            <div className="relative">
              <input
                id="initial-payment"
                type="number"
                min="0"
                value={initialPaymentRequired}
                onChange={(e) =>
                  setInitialPaymentRequired(
                    e.target.value
                  )
                }
                placeholder="مثلاً ۵۰۰۰۰۰۰۰"
                className={`${inputClass} pl-16`}
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                ریال
              </span>
            </div>

            <p className={helpClass}>
              مبلغی که طبق شرایط بیمه‌نامه باید ابتدا
              پرداخت شود.
            </p>
          </div>

          {/* ACTUAL PAYMENT */}

          <div>
            <label
              htmlFor="actual-paid"
              className={labelClass}
            >
              مبلغ پرداخت‌شده امروز
            </label>

            <div className="relative">
              <input
                id="actual-paid"
                type="number"
                min="0"
                value={actualPaidToday}
                onChange={(e) =>
                  setActualPaidToday(
                    e.target.value
                  )
                }
                placeholder="مبلغ واقعی پرداخت‌شده"
                className={`${inputClass} pl-16`}
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                ریال
              </span>
            </div>

            <p className={helpClass}>
              این مبلغ به عنوان تراکنش واقعی در سیستم ثبت
              می‌شود.
            </p>
          </div>

          {/* INSTALLMENT COUNT */}

          <div>
            <label
              htmlFor="installment-count"
              className={labelClass}
            >
              تعداد اقساط
            </label>

            <select
              id="installment-count"
              value={installmentCount}
              onChange={(e) =>
                setInstallmentCount(
                  e.target.value
                )
              }
              className={selectClass}
            >
              {Array.from(
                { length: 11 },
                (_, i) => (
                  <option
                    key={i}
                    value={i}
                  >
                    {i === 0
                      ? "بدون قسط"
                      : `${formatNumber(i)} قسط`}
                  </option>
                )
              )}
            </select>

            <p className={helpClass}>
              باقی‌مانده مبلغ بین این تعداد قسط تقسیم می‌شود.
            </p>
          </div>
        </div>

        {/* INSTALLMENT SETTINGS */}

        {numberOfInstallments > 0 && (
          <>
            <div className="mx-5 border-t border-[#E0E0E0] sm:mx-6" />

            <div className="p-5 sm:p-6">
              <div className="mb-5">
                <h3 className="text-base font-bold text-gray-950">
                  زمان‌بندی اقساط
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  فاصله زمانی سررسید اولین قسط و اقساط بعدی
                  را مشخص کنید.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="first-installment-offset"
                    className={labelClass}
                  >
                    فاصله اولین قسط
                  </label>

                  <div className="relative">
                    <input
                      id="first-installment-offset"
                      type="number"
                      min="0"
                      value={
                        firstInstallmentOffset
                      }
                      onChange={(e) =>
                        setFirstInstallmentOffset(
                          e.target.value
                        )
                      }
                      className={`${inputClass} pl-14`}
                    />

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                      روز
                    </span>
                  </div>

                  <p className={helpClass}>
                    تعداد روز از شروع بیمه‌نامه تا سررسید
                    قسط اول.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="installment-interval"
                    className={labelClass}
                  >
                    فاصله بین اقساط
                  </label>

                  <div className="relative">
                    <input
                      id="installment-interval"
                      type="number"
                      min="1"
                      value={
                        installmentInterval
                      }
                      onChange={(e) =>
                        setInstallmentInterval(
                          e.target.value
                        )
                      }
                      className={`${inputClass} pl-14`}
                    />

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                      روز
                    </span>
                  </div>

                  <p className={helpClass}>
                    فاصله زمانی بین سررسید دو قسط متوالی.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ==================================================
          PAYMENT SUMMARY
      ================================================== */}

      <section className="mb-6 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
        <div className="border-b border-[#E0E0E0] bg-[#F5F5F5] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              ۴
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-950">
                خلاصه مالی
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                محاسبات مالی بر اساس اطلاعات واردشده.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* TOTAL */}

          <div className="rounded-md border border-[#E0E0E0] bg-[#F9F9F9] p-5">
            <p className="text-sm text-gray-500">
              مبلغ کل
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {formatMoney(total)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              ریال
            </p>
          </div>

          {/* REMAINING */}

          <div className="rounded-md border border-[#E0E0E0] bg-[#F9F9F9] p-5">
            <p className="text-sm text-gray-500">
              باقی‌مانده پس از پرداخت اولیه
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {formatMoney(remainingAmount)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              ریال
            </p>
          </div>

          {/* INSTALLMENT */}

          <div className="rounded-md border border-[#E0E0E0] bg-[#F9F9F9] p-5">
            <p className="text-sm text-gray-500">
              مبلغ هر قسط
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {numberOfInstallments > 0
                ? formatMoney(installmentAmount)
                : "-"}
            </p>

            {numberOfInstallments > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                {formatNumber(numberOfInstallments)} قسط
              </p>
            )}
          </div>

          {/* DEBT */}

          <div
            className={`rounded-md border p-5 ${
              upfrontDebt > 0
                ? "border-amber-200 bg-amber-50"
                : "border-green-200 bg-green-50"
            }`}
          >
            <p className="text-sm text-gray-600">
              بدهی پرداخت اولیه
            </p>

            <p className="mt-2 text-xl font-bold text-gray-950">
              {formatMoney(upfrontDebt)}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              ریال
            </p>
          </div>
        </div>

        {hasPaymentPlanMismatch && (
          <div className="mx-5 mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 sm:mx-6 sm:mb-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg text-amber-700">
                !
              </span>

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  برنامه پرداخت کامل نیست
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  مجموع مبلغ پرداخت اولیه و اقساط با مبلغ کل
                  بیمه‌نامه مطابقت ندارد. لطفاً اطلاعات پرداخت
                  را بررسی کنید.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================
          PAYMENT SCHEDULE
      ================================================== */}

      {numberOfInstallments > 0 && (
        <section className="mb-6 overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
          <div className="border-b border-[#E0E0E0] bg-[#F5F5F5] px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  برنامه پرداخت
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  برنامه اقساط به صورت خودکار محاسبه شده است.
                </p>
              </div>

              {schedule.length > 0 && (
                <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:inline-flex">
                  {formatNumber(schedule.length)} قسط
                </span>
              )}
            </div>
          </div>

          {schedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#F5F5F5]">
                    <th className="px-5 py-3.5 text-right text-sm font-bold text-gray-700">
                      قسط
                    </th>

                    <th className="px-5 py-3.5 text-right text-sm font-bold text-gray-700">
                      تاریخ سررسید
                    </th>

                    <th className="px-5 py-3.5 text-right text-sm font-bold text-gray-700">
                      مبلغ
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {schedule.map(
                    (item, index) => (
                      <tr
                        key={item.sequence}
                        className={`border-b border-gray-100 transition hover:bg-gray-50 ${
                          index % 2 === 1
                            ? "bg-[#F9F9F9]"
                            : "bg-white"
                        }`}
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                          قسط{" "}
                          {formatNumber(item.sequence)}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {formatDate(item.dueDate)}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                          {formatMoney(item.amount)}{" "}
                          <span className="font-normal text-gray-500">
                            ریال
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-500">
              برای نمایش برنامه پرداخت، تاریخ شروع، مبلغ کل
              و تعداد اقساط را وارد کنید.
            </div>
          )}
        </section>
      )}

      {/* ==================================================
          MESSAGE
      ================================================== */}

      {message && (
        <div
          role={
            messageType === "error"
              ? "alert"
              : "status"
          }
          className={`mb-6 rounded-md border p-4 ${
            messageType === "success"
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                messageType === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {messageType === "success"
                ? "✓"
                : "×"}
            </span>

            <p
              className={`text-sm font-medium leading-6 ${
                messageType === "success"
                  ? "text-green-800"
                  : "text-red-800"
              }`}
            >
              {message}
            </p>
          </div>
        </div>
      )}

      {/* ==================================================
          ACTIONS
      ================================================== */}

      <div className="border-t border-[#E0E0E0] pt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-gray-500">
            پس از ثبت، بیمه‌نامه، برنامه پرداخت و در صورت
            وجود، پرداخت واقعی اولیه در سیستم ذخیره خواهند شد.
          </p>

          <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => window.history.back()}
              disabled={saving}
              className="h-12 rounded-md border border-gray-300 bg-white px-6 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-blue-600 px-7 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  در حال ذخیره‌سازی...
                </>
              ) : renewalData ? (
                "ثبت بیمه‌نامه تمدیدی"
              ) : (
                "ایجاد بیمه‌نامه"
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}