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
      `آیا مطمئن هستید که می‌خواهید بیمه‌نامه ${policyNumber} را حذف کنید؟\n\nتمام تراکنش‌ها، تخصیص پرداخت‌ها و برنامه پرداخت این بیمه‌نامه نیز حذف خواهند شد.\n\nاین عملیات قابل بازگشت نیست.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await supabase.rpc(
        "delete_policy_completely",
        {
          p_policy_id: policyId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      router.replace("/clients");
      router.refresh();
    } catch (error) {
      console.error("Policy deletion error:", error);

      window.alert(
        error instanceof Error
          ? `حذف بیمه‌نامه انجام نشد:\n${error.message}`
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
      className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {deleting ? "در حال حذف..." : "حذف بیمه‌نامه"}
    </button>
  );
}