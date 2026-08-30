"use client";

import { useState } from "react";
import EditPolicyForm from "./EditPolicyForm";
import DeletePolicyButton from "./DeletePolicyButton";

type PolicyActionsProps = {
  policyId: string;
  policyNumber: string;
  policyType: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  initialPaymentRequired: number;
  installmentCount: number;
  firstInstallmentOffset: number | null;
  installmentInterval: number | null;
  hasTransactions: boolean;
};

export default function PolicyActions(props: PolicyActionsProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditPolicyForm
        policyId={props.policyId}
        initialPolicyNumber={props.policyNumber}
        initialPolicyType={props.policyType}
        initialStartDate={props.startDate}
        initialEndDate={props.endDate}
        initialTotalPrice={props.totalPrice}
        initialPaymentRequired={props.initialPaymentRequired}
        initialInstallmentCount={props.installmentCount}
        initialFirstOffset={props.firstInstallmentOffset}
        initialInterval={props.installmentInterval}
        hasTransactions={props.hasTransactions}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-[#0066CC] px-5 text-sm font-semibold text-white transition hover:bg-[#0052a3]"
      >
        ویرایش بیمه‌نامه
      </button>

      <DeletePolicyButton
        policyId={props.policyId}
        policyNumber={props.policyNumber}
      />
    </div>
  );
}
