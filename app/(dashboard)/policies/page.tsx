"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ExportPoliciesButton from "./ExportPoliciesButton";
import ImportPoliciesButton from "./ImportPoliciesButton";
import { createClient } from "@/lib/supabase/client";

/* =========================================================
   TYPES
========================================================= */

type Client = {
  full_name: string | null;
  id_number: string | null;
};

type Policy = {
  id: string;
  policy_number: string | null;
  policy_type: string | null;
  start_date: string | null;
  end_date: string | null;
  total_price: number | string | null;
  client_id: string | null;
  created_at: string | null;
  clients: Client | Client[] | null;
};

/* =========================================================
   CONSTANTS
========================================================= */

const ITEMS_PER_PAGE = 20;

/* =========================================================
   HELPERS
========================================================= */

/*
 * Convert Persian/Arabic numerals to English numerals.
 *
 * This makes searching policy numbers work whether
 * the user types:
 *
 * 123456
 * ۱۲۳۴۵۶
 * ١٢٣٤٥٦
 */
function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
      )
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
      )
    );
}

/*
 * Normalize text for searching.
 */
function normalizeSearchText(
  value: string
): string {
  return normalizeDigits(value)
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک");
}

/*
 * Return the client regardless of whether Supabase
 * returns the relationship as an object or an array.
 */
function getClient(
  policy: Policy
): Client | null {
  if (!policy.clients) {
    return null;
  }

  if (Array.isArray(policy.clients)) {
    return policy.clients[0] ?? null;
  }

  return policy.clients;
}

/*
 * Format money using Persian numerals.
 */
function formatMoney(
  value: number
): string {
  return new Intl.NumberFormat(
    "fa-IR"
  ).format(
    Math.round(value)
  );
}

/*
 * Display Gregorian database dates as Persian/Jalali dates.

 * IMPORTANT:
 * We are NOT converting a Jalali date into another
 * calendar here. The database date is interpreted as
 * a calendar date and displayed using the Persian
 * calendar.
 */
function formatDate(
  dateString: string | null
): string {
  if (!dateString) {
    return "—";
  }

  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

/*
 * Policy status based on end date.
 */
function getPolicyStatus(
  endDate: string | null
) {
  if (!endDate) {
    return {
      label: "نامشخص",
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    };
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const end = new Date(
    `${endDate}T00:00:00`
  );

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    return {
      label: "نامشخص",
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    };
  }

  const difference =
    end.getTime() -
    today.getTime();

  const daysRemaining =
    Math.ceil(
      difference /
        (1000 *
          60 *
          60 *
          24)
    );

  if (
    daysRemaining < 0
  ) {
    return {
      label: "منقضی شده",
      className:
        "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (
    daysRemaining <= 10
  ) {
    return {
      label: "نزدیک به انقضا",
      className:
        "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    label: "فعال",
    className:
      "bg-green-50 text-green-700 border-green-200",
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function PoliciesPage() {
  const [policies, setPolicies] =
    useState<Policy[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [sortField, setSortField] =
    useState<
      "recent" |
      "policy_number" |
      "start_date"
    >("recent");

  const [sortDirection, setSortDirection] =
    useState<
      "asc" | "desc"
    >("desc");

  /* =======================================================
     LOAD POLICIES

     IMPORTANT:
     There is NO auth check here.

     Authentication is handled by the application's
     middleware/proxy. This page should not redirect
     users to /login.
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadPolicies() {
      setLoading(true);
      setError(null);

      const supabase =
        createClient();

      const {
        data,
        error: fetchError,
      } = await supabase
        .from("policies")
        .select(`
          id,
          policy_number,
          policy_type,
          start_date,
          end_date,
          total_price,
          client_id,
          created_at,
          clients (
            full_name,
            id_number
          )
        `)
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (cancelled) {
        return;
      }

      if (fetchError) {
        console.error(
          "Policies loading error:",
          fetchError
        );

        setError(
          fetchError.message ||
            "خطا در بارگذاری بیمه‌نامه‌ها"
        );

        setLoading(false);
        return;
      }

      setPolicies(
        (data as unknown as Policy[]) ??
          []
      );

      setLoading(false);
    }

    loadPolicies();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     SEARCH + SORT
  ======================================================= */

  const filteredAndSortedPolicies =
    useMemo(() => {
      let result =
        [...policies];

      const searchValue =
        normalizeSearchText(
          search
        );

      /* ---------------------------------------------------
         SEARCH

         Search by:
         1. Client name
         2. Policy number
      --------------------------------------------------- */

      if (searchValue) {
        result =
          result.filter(
            (policy) => {
              const client =
                getClient(
                  policy
                );

              const clientName =
                normalizeSearchText(
                  client?.full_name ??
                    ""
                );

              const policyNumber =
                normalizeSearchText(
                  policy.policy_number ??
                    ""
                );

              return (
                clientName.includes(
                  searchValue
                ) ||
                policyNumber.includes(
                  searchValue
                )
              );
            }
          );
      }

      /* ---------------------------------------------------
         SORT
      --------------------------------------------------- */

      if (
        sortField ===
        "policy_number"
      ) {
        result.sort(
          (a, b) => {
            const aValue =
              normalizeSearchText(
                a.policy_number ??
                  ""
              );

            const bValue =
              normalizeSearchText(
                b.policy_number ??
                  ""
              );

            const comparison =
              aValue.localeCompare(
                bValue,
                "en",
                {
                  numeric: true,
                  sensitivity:
                    "base",
                }
              );

            return sortDirection ===
              "asc"
              ? comparison
              : -comparison;
          }
        );
      }

      if (
        sortField ===
        "start_date"
      ) {
        result.sort(
          (a, b) => {
            const aValue =
              a.start_date ??
              "";

            const bValue =
              b.start_date ??
              "";

            const comparison =
              aValue.localeCompare(
                bValue
              );

            return sortDirection ===
              "asc"
              ? comparison
              : -comparison;
          }
        );
      }

      /*
       * "recent" means newest created first.
       */
      if (
        sortField ===
        "recent"
      ) {
        result.sort(
          (a, b) => {
            const aTime =
              a.created_at
                ? new Date(
                    a.created_at
                  ).getTime()
                : 0;

            const bTime =
              b.created_at
                ? new Date(
                    b.created_at
                  ).getTime()
                : 0;

            return (
              bTime - aTime
            );
          }
        );
      }

      return result;
    }, [
      policies,
      search,
      sortField,
      sortDirection,
    ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalItems =
    filteredAndSortedPolicies.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalItems /
          ITEMS_PER_PAGE
      )
    );

  const displayedPolicies =
    filteredAndSortedPolicies.slice(
      (page - 1) *
        ITEMS_PER_PAGE,
      page *
        ITEMS_PER_PAGE
    );

  /*
   * If search/sort reduces the number of pages,
   * make sure we don't remain on a nonexistent page.
   */
  useEffect(() => {
    if (
      page > totalPages
    ) {
      setPage(totalPages);
    }
  }, [
    page,
    totalPages,
  ]);

  /* =======================================================
     SEARCH
  ======================================================= */

  function handleSearch(
    value: string
  ) {
    setSearch(value);
    setPage(1);
  }

  /* =======================================================
     SORT
  ======================================================= */

  function handleSort(
    field:
      | "policy_number"
      | "start_date"
  ) {
    setPage(1);

    /*
     * Clicking the same sort button reverses
     * the direction.
     */
    if (
      sortField === field
    ) {
      setSortDirection(
        (current) =>
          current ===
          "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    /*
     * First click on a new field = ascending.
     */
    setSortField(field);
    setSortDirection(
      "asc"
    );
  }

  /* =======================================================
     PAGINATION CONTROLS
  ======================================================= */

  function goToPreviousPage() {
    setPage(
      (current) =>
        Math.max(
          1,
          current - 1
        )
    );
  }

  function goToNextPage() {
    setPage(
      (current) =>
        Math.min(
          totalPages,
          current + 1
        )
    );
  }

  /* =======================================================
     PAGE NUMBERS
  ======================================================= */

  const pageNumbers =
    useMemo(() => {
      const pages: number[] =
        [];

      const maxVisiblePages = 5;

      if (
        totalPages <=
        maxVisiblePages
      ) {
        for (
          let i = 1;
          i <= totalPages;
          i++
        ) {
          pages.push(i);
        }

        return pages;
      }

      let start =
        Math.max(
          1,
          page - 2
        );

      let end =
        Math.min(
          totalPages,
          start +
            maxVisiblePages -
            1
        );

      if (
        end -
          start +
          1 <
        maxVisiblePages
      ) {
        start =
          Math.max(
            1,
            end -
              maxVisiblePages +
              1
          );
      }

      for (
        let i = start;
        i <= end;
        i++
      ) {
        pages.push(i);
      }

      return pages;
    }, [
      page,
      totalPages,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="mb-8">
            <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />

            <div className="mt-3 h-5 w-80 animate-pulse rounded bg-gray-200" />
          </div>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="h-24 animate-pulse bg-gray-100" />

            <div className="space-y-4 p-5">
              {Array.from({
                length: 8,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-12 animate-pulse rounded-lg bg-gray-100"
                  />
                )
              )}
            </div>

          </section>

        </div>
      </main>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-gray-50"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              بیمه‌نامه‌ها
            </h1>
          </div>

          <div
            role="alert"
            className="rounded-lg border border-red-200 border-r-4 bg-red-50 p-5 text-red-800"
          >
            <p className="font-semibold">
              خطا در بارگذاری بیمه‌نامه‌ها
            </p>

            <p className="mt-2 text-sm">
              {error}
            </p>
          </div>

        </div>
      </main>
    );
  }

  /* =======================================================
     MAIN PAGE
  ======================================================= */

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xl text-white shadow-sm">
                🛡
              </div>

              <div>

                <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
                  بیمه‌نامه‌ها
                </h1>

                <p className="mt-1 text-sm text-gray-500 sm:text-base">
                  مدیریت و مشاهده بیمه‌نامه‌های مشتریان
                </p>

              </div>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <ExportPoliciesButton />

              <ImportPoliciesButton />

              <Link
                href="/policies/new"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span className="text-lg leading-none">
                  +
                </span>

                بیمه‌نامه جدید
              </Link>

            </div>

          </div>

        </div>

        {/* =================================================
            TABLE CARD
        ================================================= */}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          {/* =================================================
              SEARCH + SORT
          ================================================= */}

          <div className="border-b border-gray-200 px-5 py-5">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

              {/* SEARCH */}

              <div className="w-full lg:max-w-xl">

                <label
                  htmlFor="policy-search"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  جستجوی بیمه‌نامه
                </label>

                <div className="relative">

                  <input
                    id="policy-search"
                    type="text"
                    value={search}
                    onChange={(event) =>
                      handleSearch(
                        event.target.value
                      )
                    }
                    placeholder="نام مشتری یا شماره بیمه‌نامه..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                  </span>

                  {search.length >
                    0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSearch("")
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      aria-label="پاک کردن جستجو"
                    >
                      ×
                    </button>
                  )}

                </div>

              </div>

              {/* SORT */}

              <div className="flex flex-col gap-2">

                <span className="text-sm font-semibold text-gray-700">
                  مرتب‌سازی
                </span>

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      handleSort(
                        "policy_number"
                      )
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      sortField ===
                      "policy_number"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    شماره بیمه‌نامه

                    {sortField ===
                      "policy_number" && (
                      <span>
                        {sortDirection ===
                        "asc"
                          ? "↑"
                          : "↓"}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSort(
                        "start_date"
                      )
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      sortField ===
                      "start_date"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    تاریخ شروع

                    {sortField ===
                      "start_date" && (
                      <span>
                        {sortDirection ===
                        "asc"
                          ? "↑"
                          : "↓"}
                      </span>
                    )}
                  </button>

                  {sortField !==
                    "recent" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSortField(
                          "recent"
                        );
                        setSortDirection(
                          "desc"
                        );
                        setPage(1);
                      }}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      جدیدترین
                    </button>
                  )}

                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              RESULT INFORMATION
          ================================================= */}

          <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-sm text-gray-600">

              {totalItems === 0 ? (
                "هیچ بیمه‌نامه‌ای پیدا نشد."
              ) : (
                <>
                  نمایش{" "}

                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat(
                      "fa-IR"
                    ).format(
                      (page - 1) *
                        ITEMS_PER_PAGE +
                        1
                    )}
                  </span>

                  {" "}تا{" "}

                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat(
                      "fa-IR"
                    ).format(
                      Math.min(
                        page *
                          ITEMS_PER_PAGE,
                        totalItems
                      )
                    )}
                  </span>

                  {" "}از{" "}

                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat(
                      "fa-IR"
                    ).format(
                      totalItems
                    )}
                  </span>

                  {" "}بیمه‌نامه
                </>
              )}

            </p>

            {search.trim() !==
              "" && (
              <p className="text-xs text-gray-500">
                جستجو بر اساس نام مشتری یا شماره بیمه‌نامه
              </p>
            )}

          </div>

          {/* =================================================
              NO RESULTS
          ================================================= */}

          {totalItems === 0 && (
            <div className="px-5 py-14 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-xl">
                🔍
              </div>

              <h2 className="mt-4 text-lg font-bold text-gray-900">
                نتیجه‌ای پیدا نشد
              </h2>

              {search.trim() !==
                "" ? (
                <>
                  <p className="mt-2 text-sm text-gray-500">
                    هیچ بیمه‌نامه‌ای با عبارت جستجوی واردشده پیدا نشد.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      handleSearch("")
                    }
                    className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    پاک کردن جستجو
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  هنوز بیمه‌نامه‌ای ثبت نشده است.
                </p>
              )}

            </div>
          )}

          {/* =================================================
              TABLE
          ================================================= */}

          {displayedPolicies.length >
            0 && (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px] border-collapse">

                <thead>

                  <tr className="border-b border-gray-200 bg-gray-50">

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      مشتری
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      شماره بیمه‌نامه
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      نوع بیمه
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      تاریخ شروع
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      تاریخ پایان
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      مبلغ کل
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      وضعیت
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600">
                      عملیات
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {displayedPolicies.map(
                    (
                      policy,
                      index
                    ) => {
                      const client =
                        getClient(
                          policy
                        );

                      const status =
                        getPolicyStatus(
                          policy.end_date
                        );

                      return (
                        <tr
                          key={
                            policy.id
                          }
                          className={`border-b border-gray-100 transition hover:bg-blue-50/40 ${
                            index %
                              2 ===
                            1
                              ? "bg-gray-50/40"
                              : "bg-white"
                          }`}
                        >

                          {/* CLIENT */}

                          <td className="px-4 py-4">

                            <div>

                              <p className="font-semibold text-gray-900">
                                {client?.full_name ||
                                  "نامشخص"}
                              </p>

                              {client?.id_number && (
                                <p className="mt-1 text-xs text-gray-500">
                                  کد ملی:{" "}
                                  {
                                    client.id_number
                                  }
                                </p>
                              )}

                            </div>

                          </td>

                          {/* POLICY NUMBER */}

                          <td className="px-4 py-4">

                            <Link
                              href={`/policies/${policy.id}`}
                              className="font-semibold text-blue-600 transition hover:text-blue-800 hover:underline"
                            >
                              {policy.policy_number ||
                                "—"}
                            </Link>

                          </td>

                          {/* POLICY TYPE */}

                          <td className="px-4 py-4">

                            <span className="text-sm text-gray-700">
                              {policy.policy_type ||
                                "—"}
                            </span>

                          </td>

                          {/* START DATE */}

                          <td className="px-4 py-4 text-sm text-gray-700">
                            {formatDate(
                              policy.start_date
                            )}
                          </td>

                          {/* END DATE */}

                          <td className="px-4 py-4 text-sm text-gray-700">
                            {formatDate(
                              policy.end_date
                            )}
                          </td>

                          {/* PRICE */}

                          <td className="px-4 py-4">

                            <div>

                              <p className="font-semibold text-gray-900">
                                {formatMoney(
                                  Number(
                                    policy.total_price ??
                                      0
                                  )
                                )}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                ریال
                              </p>

                            </div>

                          </td>

                          {/* STATUS */}

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {
                                status.label
                              }
                            </span>

                          </td>

                          {/* ACTIONS */}

                          <td className="px-4 py-4">

                            <div className="flex items-center gap-2">

                              <Link
                                href={`/policies/${policy.id}`}
                                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              >
                                مشاهده
                              </Link>

                              <Link
                                href={`/policies/new?renewFrom=${policy.id}`}
                                className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                              >
                                تمدید
                              </Link>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          {totalItems >
            0 && (
            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="text-sm text-gray-500">

                صفحه{" "}

                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat(
                    "fa-IR"
                  ).format(
                    page
                  )}
                </span>

                {" "}از{" "}

                <span className="font-semibold text-gray-900">
                  {new Intl.NumberFormat(
                    "fa-IR"
                  ).format(
                    totalPages
                  )}
                </span>

              </div>

              <div className="flex items-center gap-2">

                {/* PREVIOUS */}

                <button
                  type="button"
                  onClick={
                    goToPreviousPage
                  }
                  disabled={
                    page <= 1
                  }
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  قبلی
                </button>

                {/* PAGE NUMBERS */}

                <div className="flex items-center gap-1">

                  {pageNumbers.map(
                    (
                      pageNumber
                    ) => (
                      <button
                        key={
                          pageNumber
                        }
                        type="button"
                        onClick={() =>
                          setPage(
                            pageNumber
                          )
                        }
                        className={`h-10 min-w-10 rounded-lg px-3 text-sm font-medium transition ${
                          page ===
                          pageNumber
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {new Intl.NumberFormat(
                          "fa-IR"
                        ).format(
                          pageNumber
                        )}
                      </button>
                    )
                  )}

                </div>

                {/* NEXT */}

                <button
                  type="button"
                  onClick={
                    goToNextPage
                  }
                  disabled={
                    page >=
                    totalPages
                  }
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  بعدی
                </button>

              </div>

            </div>
          )}

        </section>

      </div>
    </main>
  );
}