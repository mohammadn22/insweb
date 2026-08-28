"use client";

import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

export default function ExportDebtsButton() {
  const supabase = createClient();

  async function handleExport() {
    const { data: schedules, error: schedulesError } =
      await supabase
        .from("payment_schedule")
        .select(`
          id,
          policy_id,
          sequence_number,
          description,
          amount_due,
          due_date,
          policies (
            policy_number,
            policy_type,
            clients (
              full_name,
              id_number
            )
          )
        `)
        .order("due_date", {
          ascending: true,
        });

    if (schedulesError) {
      alert(
        `Failed to load debts: ${schedulesError.message}`
      );
      return;
    }

    const scheduleIds = (schedules ?? []).map(
      (schedule) => schedule.id
    );

    let allocations: {
      payment_schedule_id: string;
      amount: number;
    }[] = [];

    if (scheduleIds.length > 0) {
      const {
        data,
        error,
      } = await supabase
        .from("transaction_allocations")
        .select(
          "payment_schedule_id, amount"
        )
        .in(
          "payment_schedule_id",
          scheduleIds
        );

      if (error) {
        alert(
          `Failed to load payment allocations: ${error.message}`
        );
        return;
      }

      allocations = (data ?? []).map(
        (allocation) => ({
          payment_schedule_id:
            allocation.payment_schedule_id,
          amount: Number(
            allocation.amount ?? 0
          ),
        })
      );
    }

    const paidBySchedule = new Map<
      string,
      number
    >();

    for (const allocation of allocations) {
      const current =
        paidBySchedule.get(
          allocation.payment_schedule_id
        ) ?? 0;

      paidBySchedule.set(
        allocation.payment_schedule_id,
        current + allocation.amount
      );
    }

    const today =
      new Date().toISOString().split("T")[0];

    const rows = (schedules ?? [])
      .map((schedule) => {
        const paid =
          paidBySchedule.get(schedule.id) ?? 0;

        const amountDue = Number(
          schedule.amount_due ?? 0
        );

        const remaining = Math.max(
          amountDue - paid,
          0
        );

        const policy = Array.isArray(
          schedule.policies
        )
          ? schedule.policies[0]
          : schedule.policies;

        const client = policy?.clients
          ? Array.isArray(policy.clients)
            ? policy.clients[0]
            : policy.clients
          : null;

        const overdue =
          remaining > 0 &&
          schedule.due_date < today;

        return {
          "Client Name":
            client?.full_name ?? "",
          "Client ID Number":
            client?.id_number ?? "",
          "Policy Number":
            policy?.policy_number ?? "",
          "Policy Type":
            policy?.policy_type ?? "",
          Payment:
            schedule.description ?? "",
          "Due Date":
            schedule.due_date,
          "Amount Due":
            amountDue,
          Paid:
            paid,
          Remaining:
            remaining,
          Status:
            overdue
              ? "Overdue"
              : remaining > 0
                ? "Due"
                : "Paid",
        };
      })
      .filter(
        (row) => row.Remaining > 0
      );

    const csv = Papa.unparse(rows);

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = "debts.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-md border bg-white px-4 py-2 hover:bg-gray-50"
    >
      Export Debts CSV
    </button>
  );
}