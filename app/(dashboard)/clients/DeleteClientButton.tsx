"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DeleteClientButtonProps = {
  clientId: string;
  clientName: string;
};

export default function DeleteClientButton({
  clientId,
  clientName,
}: DeleteClientButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleDelete() {
    const confirmed = window.confirm(
      `آیا مطمئن هستید که می‌خواهید ${clientName} را حذف کنید؟`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (error) {
      alert("حذف مشتری با خطا مواجه شد.");
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-red-600 hover:text-red-800"
    >
      حذف
    </button>
  );
}