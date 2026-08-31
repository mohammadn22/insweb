"use client";

import { useState } from "react";
import RecordPaymentForm from "./RecordPaymentForm";

type AddPaymentButtonProps = {
  policyId: string;
};

export default function AddPaymentButton({
  policyId,
}: AddPaymentButtonProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0066CC] px-5 text-sm font-semibold text-white transition hover:bg-[#0052a3]"
      >
        {showForm ? "بستن" : "ثبت پرداخت جدید"}
      </button>

      {showForm && (
        <div className="mt-5">
          <RecordPaymentForm policyId={policyId} />
        </div>
      )}
    </div>
  );
}