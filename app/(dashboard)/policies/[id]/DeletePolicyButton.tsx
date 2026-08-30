"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DeletePolicyButtonProps = {
  policyId: string;
  policyNumber: string;
};

export default function DeletePolicyButton({
  policyId,
  policyNumber,
}: DeletePolicyButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `آیا مطمئن هستید که می‌خواهید بیمه‌نامه ${policyNumber} را حذف کنید؟\n\nتمام تراکنش‌ها، تخصیص پرداخت‌ها و برنامه پرداخت این بیمه‌نامه نیز حذف خواهند شد. این عملیات قابل بازگشت نیست.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      // Keep renewal policies intact. They simply lose their previous-policy link.
      const { error: unlinkError } = await supabase
        .from("policies")
        .update({ previous_policy_id: null })
        .eq("previous_policy_id", policyId);

      if (unlinkError) {
        throw new Error(unlinkError.message);
      }

      const { data: schedules, error: schedulesError } = await supabase
        .from("payment_schedule")
        .select("id")
        .eq("policy_id", policyId);

      if (schedulesError) {
        throw new Error(schedulesError.message);
      }

      const scheduleIds = (schedules ?? []).map((row) => row.id);

      let transactionIds: string[] = [];

      const { data: transactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("id")
        .eq("policy_id", policyId);

      if (transactionsError) {
        throw new Error(transactionsError.message);
      }

      transactionIds = (transactions ?? []).map((row) => row.id);

      if (scheduleIds.length > 0) {
        const { error: allocationByScheduleError } = await supabase
          .from("transaction_allocations")
          .delete()
          .in("payment_schedule_id", scheduleIds);

        if (allocationByScheduleError) {
          throw new Error(allocationByScheduleError.message);
        }
      }

      if (transactionIds.length > 0) {
        const { error: allocationByTransactionError } = await supabase
          .from("transaction_allocations")
          .delete()
          .in("transaction_id", transactionIds);

        if (allocationByTransactionError) {
          throw new Error(allocationByTransactionError.message);
        }
      }

      const { error: transactionsDeleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("policy_id", policyId);

      if (transactionsDeleteError) {
        throw new Error(transactionsDeleteError.message);
      }

      const { error: schedulesDeleteError } = await supabase
        .from("payment_schedule")
        .delete()
        .eq("policy_id", policyId);

      if (schedulesDeleteError) {
        throw new Error(schedulesDeleteError.message);
      }

      const { error: policyDeleteError } = await supabase
        .from("policies")
        .delete()
        .eq("id", policyId);

      if (policyDeleteError) {
        throw new Error(policyDeleteError.message);
      }

      router.replace(`/clients`);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `حذف بیمه‌نامه انجام نشد: ${error.message}`
          : "حذف بیمه‌نامه با خطای غیرمنتظره مواجه شد."
      );
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {deleting ? "در حال حذف..." : "حذف بیمه‌نامه"}
    </button>
  );
}
