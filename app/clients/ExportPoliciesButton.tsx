"use client";

import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

export default function ExportPoliciesButton() {
  const supabase = createClient();

  async function handleExport() {
    const { data, error } = await supabase
      .from("policies")
      .select(`
        policy_number,
        policy_type,
        start_date,
        end_date,
        total_price,
        clients (
          full_name,
          id_number
        )
      `)
      .order("start_date", {
        ascending: false,
      });

    if (error) {
      alert(
        `Failed to export policies: ${error.message}`
      );
      return;
    }

    const rows = (data ?? []).map((policy) => {
      const client = Array.isArray(policy.clients)
        ? policy.clients[0]
        : policy.clients;

      return {
        "Policy Number": policy.policy_number,
        "Policy Type": policy.policy_type,
        "Client Name": client?.full_name ?? "",
        "Client ID Number": client?.id_number ?? "",
        "Start Date": policy.start_date,
        "End Date": policy.end_date,
        "Total Price": Number(policy.total_price ?? 0),
      };
    });

    const csv = Papa.unparse(rows);

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = "policies.csv";

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
      Export Policies CSV
    </button>
  );
}