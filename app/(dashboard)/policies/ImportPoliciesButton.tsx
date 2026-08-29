"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import {
  parseAmount,
  parseJalaliTextToGregorianISO,
  readTextValue,
} from "@/lib/date-utils";

const IMPORT_POLICY_TYPE = "بیمه شخص ثالث خودرو";

type ScheduleRow = {
  amount: number;
  dueDateISO: string;
};

type PolicyGroup = {
  excelRow: number;
  policyNumber: string;
  startDateISO: string | null;
  endDateISO: string | null;
  clientName: string;
  clientIdNumber: string;
  mobile: string;
  address: string;
  schedule: ScheduleRow[];
  errors: string[];
};

type ImportResult = {
  policy_number: string;
  status: "imported" | "skipped" | "failed";
  reason?: string;
};

function groupRows(rows: unknown[][]): PolicyGroup[] {
  const groups: PolicyGroup[] = [];
  let current: PolicyGroup | null = null;

  rows.forEach((row, index) => {
    const excelRow = index + 2; // header occupies row 1
    const [a, b, c, d, e, f, g, h, i] = row;

    const hasPolicyNumber =
      a !== undefined && a !== null && String(a).trim() !== "";

    if (hasPolicyNumber) {
      current = {
        excelRow,
        policyNumber: readTextValue(a),
        startDateISO: parseJalaliTextToGregorianISO(b),
        endDateISO: parseJalaliTextToGregorianISO(c),
        clientName: String(d ?? "").trim(),
        clientIdNumber: readTextValue(e),
        mobile: readTextValue(h),
        address: String(i ?? "").trim(),
        schedule: [],
        errors: [],
      };
      groups.push(current);
    }

    const hasPaymentAmount =
      f !== undefined && f !== null && String(f).trim() !== "";

    if (current && hasPaymentAmount) {
      const amount = parseAmount(f);
      const dueDateISO = parseJalaliTextToGregorianISO(g);

      if (amount === null || dueDateISO === null) {
        current.errors.push(
          `ردیف ${excelRow}: مبلغ یا تاریخ پرداخت نامعتبر است.`
        );
      } else {
        current.schedule.push({ amount, dueDateISO });
      }
    }
  });

  return groups;
}

function validateGroup(group: PolicyGroup, seenPolicyNumbers: Set<string>) {
  const errors = [...group.errors];

  if (!group.policyNumber) {
    errors.push("شماره بیمه‌نامه خالی است.");
  } else if (seenPolicyNumbers.has(group.policyNumber)) {
    errors.push("این شماره بیمه‌نامه در فایل تکراری است.");
  }

  if (!group.clientName) errors.push("نام بیمه‌گذار خالی است.");
  if (!group.clientIdNumber) errors.push("کد ملی بیمه‌گذار خالی است.");
  if (!group.startDateISO) errors.push("تاریخ شروع نامعتبر است.");
  if (!group.endDateISO) errors.push("تاریخ پایان نامعتبر است.");

  if (
    group.startDateISO &&
    group.endDateISO &&
    group.endDateISO <= group.startDateISO
  ) {
    errors.push("تاریخ پایان باید بعد از تاریخ شروع باشد.");
  }

  if (group.schedule.length === 0) {
    errors.push("هیچ ردیف پرداخت معتبری برای این بیمه‌نامه یافت نشد.");
  }

  return errors;
}

function downloadTemplate() {
  const headers = [
    "شماره بیمه نامه",
    "تاریخ شروع بیمه‌نامه",
    "تاریخ پایان بیمه‌نامه",
    "نام بیمه‌ گذار",
    "کد ملی بیمه گذار",
    "مبلغ پرداختی",
    "تاریخ",
    "شماره همراه",
    "آدرس",
  ];

  const example = [
    ["1234567", "1403/01/01", "1404/01/01", "علی رضایی", "0123456789", "", "", "09121234567", "تهران"],
    ["", "", "", "", "", "5000000", "1403/01/01", "", ""],
    ["", "", "", "", "", "3000000", "1403/04/01", "", ""],
    ["", "", "", "", "", "3000000", "1403/07/01", "", ""],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...example]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Policies");
  XLSX.writeFile(book, "policies-import-template.xlsx");
}

export default function ImportPoliciesButton() {
  const supabase = createClient();

  const [groups, setGroups] = useState<PolicyGroup[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [readError, setReadError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setReadError("");
    setResults(null);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
          defval: "",
        });

        const dataRows = rows.slice(1); // drop header row
        const parsedGroups = groupRows(dataRows);

        const seen = new Set<string>();
        for (const group of parsedGroups) {
          group.errors = validateGroup(group, seen);
          if (group.policyNumber) seen.add(group.policyNumber);
        }

        setGroups(parsedGroups);
      } catch {
        setReadError("خواندن فایل اکسل با خطا مواجه شد.");
        setGroups([]);
      }
    };

    reader.readAsBinaryString(file);
  }

  const validGroups = groups.filter((g) => g.errors.length === 0);
  const invalidGroups = groups.filter((g) => g.errors.length > 0);

  async function handleImport() {
    if (validGroups.length === 0) return;

    setImporting(true);
    setResults(null);

    try {
      const payload = validGroups.map((group) => ({
        policy_number: group.policyNumber,
        policy_type: IMPORT_POLICY_TYPE,
        start_date: group.startDateISO,
        end_date: group.endDateISO,
        total_price: group.schedule.reduce((sum, s) => sum + s.amount, 0),
        client_full_name: group.clientName,
        client_id_number: group.clientIdNumber,
        client_mobile: group.mobile,
        client_address: group.address,
        schedule: group.schedule.map((item, index) => ({
          sequence_number: index + 1,
          description: `پرداخت ${index + 1}`,
          amount_due: item.amount,
          due_date: item.dueDateISO,
        })),
      }));

      const { data, error } = await supabase.rpc("import_policies_batch", {
        p_policies: payload,
      });

      if (error) {
        throw new Error(error.message);
      }

      setResults(data as ImportResult[]);
      setGroups([]);
      setFileName("");
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "ثبت بیمه‌نامه‌ها انجام نشد."
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-md border bg-white px-4 py-2 hover:bg-gray-50">
          وارد کردن بیمه‌نامه‌ها (Excel)
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-md border bg-white px-4 py-2 hover:bg-gray-50"
        >
          دانلود قالب نمونه
        </button>

        {fileName && <span className="text-sm text-gray-600">{fileName}</span>}
      </div>

      {readError && <p className="mt-3 text-sm text-red-600">{readError}</p>}

      {groups.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-green-700">
              معتبر: {validGroups.length}
            </span>
            <span className="font-semibold text-red-600">
              دارای خطا: {invalidGroups.length}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2 text-right">ردیف</th>
                  <th className="border p-2 text-right">شماره بیمه‌نامه</th>
                  <th className="border p-2 text-right">بیمه‌گذار</th>
                  <th className="border p-2 text-right">کد ملی</th>
                  <th className="border p-2 text-right">تعداد پرداخت</th>
                  <th className="border p-2 text-right">مجموع مبلغ</th>
                  <th className="border p-2 text-right">وضعیت</th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <tr key={group.excelRow}>
                    <td className="border p-2">{group.excelRow}</td>
                    <td className="border p-2">{group.policyNumber || "-"}</td>
                    <td className="border p-2">{group.clientName || "-"}</td>
                    <td className="border p-2">{group.clientIdNumber || "-"}</td>
                    <td className="border p-2">{group.schedule.length}</td>
                    <td className="border p-2">
                      {group.schedule
                        .reduce((sum, s) => sum + s.amount, 0)
                        .toLocaleString("fa-IR")}
                    </td>
                    <td className="border p-2">
                      {group.errors.length === 0 ? (
                        <span className="text-green-700">آماده ثبت</span>
                      ) : (
                        <span className="text-red-600">
                          {group.errors.join(" / ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={validGroups.length === 0 || importing}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {importing
              ? "در حال ثبت..."
              : `ثبت ${validGroups.length} بیمه‌نامه معتبر`}
          </button>
        </div>
      )}

      {results && (
        <div className="mt-5 overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-right">شماره بیمه‌نامه</th>
                <th className="border p-2 text-right">نتیجه</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.policy_number}>
                  <td className="border p-2">{result.policy_number}</td>
                  <td className="border p-2">
                    {result.status === "imported" && (
                      <span className="text-green-700">ثبت شد</span>
                    )}
                    {result.status === "skipped" && (
                      <span className="text-amber-700">
                        نادیده گرفته شد (شماره تکراری در سیستم)
                      </span>
                    )}
                    {result.status === "failed" && (
                      <span className="text-red-600">
                        خطا: {result.reason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}