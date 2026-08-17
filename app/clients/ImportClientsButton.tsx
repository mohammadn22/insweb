"use client";

import { useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

type ImportedClient = {
  full_name: string;
  id_number: string;
  mobile: string;
  address: string;
};

type ParsedRow = {
  "Full Name"?: string;
  "ID Number"?: string;
  Mobile?: string;
  Address?: string;
};

export default function ImportClientsButton() {
  const supabase = createClient();

  const [clients, setClients] = useState<
    ImportedClient[]
  >([]);

  const [fileName, setFileName] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [importing, setImporting] =
    useState(false);

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setMessage("");
    setClients([]);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",

      complete: (results) => {
        const parsedClients: ImportedClient[] =
          [];

        for (const row of results.data) {
          const fullName =
            row["Full Name"]?.trim() ?? "";

          const idNumber =
            row["ID Number"]?.trim() ?? "";

          const mobile =
            row["Mobile"]?.trim() ?? "";

          const address =
            row["Address"]?.trim() ?? "";

          if (!fullName && !idNumber) {
            continue;
          }

          parsedClients.push({
            full_name: fullName,
            id_number: idNumber,
            mobile,
            address,
          });
        }

        setClients(parsedClients);

        if (parsedClients.length === 0) {
          setMessage(
            "No valid client rows were found."
          );
        }
      },

      error: (error) => {
        setMessage(
          `Failed to read CSV: ${error.message}`
        );
      },
    });
  }

  async function handleImport() {
    if (clients.length === 0) {
      return;
    }

    setImporting(true);
    setMessage("");

    try {
      const invalidClients =
        clients.filter(
          (client) =>
            !client.full_name ||
            !client.id_number
        );

      if (invalidClients.length > 0) {
        setMessage(
          `${invalidClients.length} client(s) are missing Full Name or ID Number.`
        );
        return;
      }

      const idNumbers =
        clients.map(
          (client) => client.id_number
        );

      const duplicateIds =
        new Set(
          idNumbers.filter(
            (id, index) =>
              idNumbers.indexOf(id) !==
              index
          )
        );

      if (duplicateIds.size > 0) {
        setMessage(
          `Duplicate ID numbers found in the CSV: ${Array.from(
            duplicateIds
          ).join(", ")}`
        );
        return;
      }

      const { data: existingClients, error: lookupError } =
        await supabase
          .from("clients")
          .select("id_number")
          .in("id_number", idNumbers);

      if (lookupError) {
        throw new Error(
          lookupError.message
        );
      }

      const existingIds = new Set(
        (existingClients ?? []).map(
          (client) => client.id_number
        )
      );

      const newClients =
        clients.filter(
          (client) =>
            !existingIds.has(
              client.id_number
            )
        );

      if (newClients.length === 0) {
        setMessage(
          "All clients in this CSV already exist."
        );
        return;
      }

      const { error: insertError } =
        await supabase
          .from("clients")
          .insert(newClients);

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      const skipped =
        clients.length -
        newClients.length;

      setMessage(
        `Successfully imported ${newClients.length} client(s).${
          skipped > 0
            ? ` ${skipped} existing client(s) were skipped.`
            : ""
        }`
      );

      setClients([]);
      setFileName("");

      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to import clients."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">

        <label className="cursor-pointer rounded-md border bg-white px-4 py-2 hover:bg-gray-50">
          Import CSV

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {fileName && (
          <span className="text-sm text-gray-600">
            {fileName}
          </span>
        )}

        {clients.length > 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {importing
              ? "Importing..."
              : `Import ${clients.length} Client(s)`}
          </button>
        )}

      </div>

      {clients.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse border text-sm">

            <thead>
              <tr className="bg-gray-50">

                <th className="border p-2 text-left">
                  Full Name
                </th>

                <th className="border p-2 text-left">
                  ID Number
                </th>

                <th className="border p-2 text-left">
                  Mobile
                </th>

                <th className="border p-2 text-left">
                  Address
                </th>

              </tr>
            </thead>

            <tbody>
              {clients.slice(0, 10).map(
                (client, index) => (
                  <tr key={index}>

                    <td className="border p-2">
                      {client.full_name}
                    </td>

                    <td className="border p-2">
                      {client.id_number}
                    </td>

                    <td className="border p-2">
                      {client.mobile}
                    </td>

                    <td className="border p-2">
                      {client.address}
                    </td>

                  </tr>
                )
              )}
            </tbody>

          </table>

          {clients.length > 10 && (
            <p className="mt-2 text-sm text-gray-500">
              نمایش ۱۰ مورد اول از{" "}
              {clients.length} مشتری.
            </p>
          )}
        </div>
      )}

      {message && (
        <p className="mt-4 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}