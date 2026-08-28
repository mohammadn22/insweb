"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type ImportedClient = {
  full_name: string;
  id_number: string;
  mobile: string;
  address: string;
};

type ColumnKey = keyof ImportedClient;

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  full_name: ["نام و نام خانوادگی", "نام کامل", "نام مشتری", "نام"],
  id_number: ["کد ملی", "شماره ملی", "کدملی"],
  mobile: ["شماره موبایل", "موبایل", "شماره تماس", "تلفن همراه"],
  address: ["آدرس", "نشانی"],
};

const REQUIRED_COLUMNS: ColumnKey[] = ["full_name", "id_number"];

function resolveColumnIndexes(headerRow: string[]) {
  const result: Record<ColumnKey, number> = {
    full_name: -1,
    id_number: -1,
    mobile: -1,
    address: -1,
  };

  headerRow.forEach((rawHeader, index) => {
    const header = rawHeader.trim();

    (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
      if (result[key] !== -1) {
        return;
      }

      if (HEADER_ALIASES[key].includes(header)) {
        result[key] = index;
      }
    });
  });

  return result;
}

export default function ImportClientsButton() {
  const supabase = createClient();

  const [clients, setClients] = useState<ImportedClient[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [importing, setImporting] = useState(false);

  function resetFeedback() {
    setMessage("");
    setStatus("idle");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) {
      return;
    }

    setFileName(file.name);
    setClients([]);
    resetFeedback();

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;

        if (!buffer) {
          throw new Error("فایل خوانده نشد.");
        }

        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as unknown[][];

        if (rows.length === 0) {
          setMessage("فایل انتخاب‌شده خالی است.");
          setStatus("error");
          return;
        }

        const headerRow = (rows[0] ?? []).map((cell) =>
          String(cell ?? "")
        );

        const columnIndexes = resolveColumnIndexes(headerRow);

        const missingRequired = REQUIRED_COLUMNS.filter(
          (key) => columnIndexes[key] === -1
        );

        if (missingRequired.length > 0) {
          setMessage(
            "ستون‌های «نام و نام خانوادگی» و «کد ملی» در فایل پیدا نشد. لطفاً از قالب استاندارد استفاده کنید."
          );
          setStatus("error");
          return;
        }

        const parsedClients: ImportedClient[] = [];

        for (const row of rows.slice(1)) {
          const fullName = String(
            row[columnIndexes.full_name] ?? ""
          ).trim();

          const idNumber = String(
            row[columnIndexes.id_number] ?? ""
          ).trim();

          const mobile =
            columnIndexes.mobile !== -1
              ? String(row[columnIndexes.mobile] ?? "").trim()
              : "";

          const address =
            columnIndexes.address !== -1
              ? String(row[columnIndexes.address] ?? "").trim()
              : "";

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
          setMessage("هیچ ردیف معتبری در فایل پیدا نشد.");
          setStatus("error");
        }
      } catch {
        setMessage(
          "خواندن فایل اکسل با خطا مواجه شد. لطفاً از فرمت xlsx معتبر استفاده کنید."
        );
        setStatus("error");
      }
    };

    reader.onerror = () => {
      setMessage("خواندن فایل با خطا مواجه شد.");
      setStatus("error");
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (clients.length === 0) {
      return;
    }

    setImporting(true);
    resetFeedback();

    try {
      const invalidClients = clients.filter(
        (client) => !client.full_name || !client.id_number
      );

      if (invalidClients.length > 0) {
        setMessage(
          `${invalidClients.length} ردیف فاقد نام یا کد ملی است. لطفاً فایل را اصلاح کنید.`
        );
        setStatus("error");
        return;
      }

      const idNumbers = clients.map((client) => client.id_number);

      const duplicateIds = new Set(
        idNumbers.filter((id, index) => idNumbers.indexOf(id) !== index)
      );

      if (duplicateIds.size > 0) {
        setMessage(
          `کد ملی تکراری در فایل پیدا شد: ${Array.from(duplicateIds).join(
            "، "
          )}`
        );
        setStatus("error");
        return;
      }

      const { data: existingClients, error: lookupError } = await supabase
        .from("clients")
        .select("id_number")
        .in("id_number", idNumbers);

      if (lookupError) {
        throw new Error(lookupError.message);
      }

      const existingIds = new Set(
        (existingClients ?? []).map((client) => client.id_number)
      );

      const newClients = clients.filter(
        (client) => !existingIds.has(client.id_number)
      );

      if (newClients.length === 0) {
        setMessage(
          "همه مشتریان این فایل از قبل در سیستم ثبت شده‌اند."
        );
        setStatus("error");
        return;
      }

      const { error: insertError } = await supabase
        .from("clients")
        .insert(newClients);

      if (insertError) {
        throw new Error(insertError.message);
      }

      const skipped = clients.length - newClients.length;

      setMessage(
        `${newClients.length} مشتری با موفقیت اضافه شد.${
          skipped > 0
            ? ` ${skipped} مشتری تکراری نادیده گرفته شد.`
            : ""
        }`
      );
      setStatus("success");

      setClients([]);
      setFileName("");

      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "بارگذاری گروهی مشتریان انجام نشد."
      );
      setStatus("error");
    } finally {
      setImporting(false);
    }
  }

  function handleDownloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["نام و نام خانوادگی", "کد ملی", "شماره موبایل", "آدرس"],
      ["علی رضایی", "0012345678", "09121234567", "تهران، خیابان ولیعصر"],
    ]);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "مشتریان");

    XLSX.writeFile(workbook, "قالب-بارگذاری-مشتریان.xlsx");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border bg-white px-4 py-2 hover:bg-gray-50">
          بارگذاری اکسل مشتریان
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          دانلود فایل نمونه
        </button>

        {fileName && (
          <span className="text-sm text-gray-600">{fileName}</span>
        )}

        {clients.length > 0 && (
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {importing
              ? "در حال بارگذاری..."
              : `افزودن ${clients.length} مشتری`}
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        ستون‌های الزامی: «نام و نام خانوادگی» و «کد ملی». ستون‌های
        اختیاری: «شماره موبایل» و «آدرس».
      </p>

      {clients.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-right">
                  نام و نام خانوادگی
                </th>
                <th className="border p-2 text-right">کد ملی</th>
                <th className="border p-2 text-right">شماره موبایل</th>
                <th className="border p-2 text-right">آدرس</th>
              </tr>
            </thead>

            <tbody>
              {clients.slice(0, 10).map((client, index) => (
                <tr key={index}>
                  <td className="border p-2">{client.full_name}</td>
                  <td className="border p-2">{client.id_number}</td>
                  <td className="border p-2">{client.mobile}</td>
                  <td className="border p-2">{client.address}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {clients.length > 10 && (
            <p className="mt-2 text-sm text-gray-500">
              نمایش ۱۰ مورد اول از {clients.length} مشتری.
            </p>
          )}
        </div>
      )}

      {message && (
        <p
          className={`mt-4 text-sm ${
            status === "success"
              ? "text-green-600"
              : status === "error"
                ? "text-red-600"
                : "text-gray-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}