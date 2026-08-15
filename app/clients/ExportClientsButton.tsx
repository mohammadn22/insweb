"use client";

import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

export default function ExportClientsButton() {
  const supabase = createClient();

  async function handleExport() {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "full_name, id_number, mobile, address"
      )
      .order("full_name", {
        ascending: true,
      });

    if (error) {
      alert(
        `Failed to export clients: ${error.message}`
      );
      return;
    }

    const rows = (data ?? []).map((client) => ({
      "Full Name": client.full_name,
      "ID Number": client.id_number,
      "Mobile": client.mobile ?? "",
      "Address": client.address ?? "",
    }));

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
    link.download = "clients.csv";

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
      Export CSV
    </button>
  );
}