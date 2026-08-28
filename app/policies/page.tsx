import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ExportPoliciesButton from "./ExportPoliciesButton";

function formatMoney(value: number) {
  return new Intl.NumberFormat("fa-IR").format(
    Math.round(value)
  );
}

function formatDate(dateString: string) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPolicyStatus(endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(end.getTime())) {
    return {
      label: "نامشخص",
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    };
  }

  const difference =
    end.getTime() - today.getTime();

  const daysRemaining =
    Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    );

  if (daysRemaining < 0) {
    return {
      label: "منقضی شده",
      className:
        "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (daysRemaining <= 10) {
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

export default async function PoliciesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: policies, error } = await supabase
    .from("policies")
    .select(`
      id,
      policy_number,
      policy_type,
      start_date,
      end_date,
      total_price,
      client_id,
      clients (
        full_name,
        id_number
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <div className="mb-8">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-xl text-white shadow-sm">
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
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

              {/* Secondary action */}
              <ExportPoliciesButton />

              {/* Primary action */}
              <Link
                href="/policies/new"
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  bg-blue-600
                  px-5
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:-translate-y-0.5
                  hover:bg-blue-700
                  hover:shadow-md
                  focus:outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  focus:ring-offset-2
                "
              >
                <span className="text-lg leading-none">
                  +
                </span>

                بیمه‌نامه جدید
              </Link>

            </div>
          </div>
        </div>

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div
            role="alert"
            className="
              mb-6
              rounded-lg
              border
              border-red-200
              border-r-4
              bg-red-50
              p-4
              text-red-800
            "
          >
            <div className="flex items-start gap-3">

              <span className="text-lg font-bold">
                ×
              </span>

              <div>
                <p className="font-semibold">
                  خطا در بارگذاری بیمه‌نامه‌ها
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error.message}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {!error &&
          (!policies || policies.length === 0) && (
            <section
              className="
                rounded-xl
                border
                border-gray-200
                bg-white
                p-10
                text-center
                shadow-sm
              "
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
                🛡
              </div>

              <h2 className="mt-5 text-xl font-bold text-gray-900">
                هنوز بیمه‌نامه‌ای ثبت نشده است
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                برای شروع، اولین بیمه‌نامه را برای یکی از
                مشتریان خود ثبت کنید.
              </p>

              <Link
                href="/policies/new"
                className="
                  mt-6
                  inline-flex
                  items-center
                  justify-center
                  rounded-lg
                  bg-blue-600
                  px-5
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-blue-700
                "
              >
                ثبت بیمه‌نامه جدید
              </Link>
            </section>
          )}

        {/* ==================================================
            POLICY TABLE
        ================================================== */}

        {!error &&
          policies &&
          policies.length > 0 && (
            <section
              className="
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
                shadow-sm
              "
            >

              {/* Table header */}

              <div
                className="
                  flex
                  flex-col
                  gap-3
                  border-b
                  border-gray-200
                  bg-white
                  px-5
                  py-5
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    فهرست بیمه‌نامه‌ها
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {new Intl.NumberFormat("fa-IR").format(
                      policies.length
                    )}{" "}
                    بیمه‌نامه ثبت شده است
                  </p>
                </div>

                <div className="text-sm text-gray-500">
                  آخرین بیمه‌نامه‌ها در ابتدا نمایش داده می‌شوند
                </div>
              </div>

              {/* Responsive table */}

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

                    {policies.map((policy, index) => {

                      const client =
                        Array.isArray(policy.clients)
                          ? policy.clients[0]
                          : policy.clients;

                      const status =
                        getPolicyStatus(
                          policy.end_date
                        );

                      return (
                        <tr
                          key={policy.id}
                          className={`
                            border-b
                            border-gray-100
                            transition
                            hover:bg-blue-50/40
                            ${
                              index % 2 === 1
                                ? "bg-gray-50/40"
                                : "bg-white"
                            }
                          `}
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
                                  {client.id_number}
                                </p>
                              )}
                            </div>

                          </td>

                          {/* POLICY NUMBER */}

                          <td className="px-4 py-4">

                            <Link
                              href={`/policies/${policy.id}`}
                              className="
                                font-semibold
                                text-blue-600
                                transition
                                hover:text-blue-800
                                hover:underline
                              "
                            >
                              {policy.policy_number}
                            </Link>

                          </td>

                          {/* POLICY TYPE */}

                          <td className="px-4 py-4">

                            <span className="text-sm text-gray-700">
                              {policy.policy_type}
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
                                    policy.total_price
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
                              className={`
                                inline-flex
                                items-center
                                rounded-full
                                border
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                ${status.className}
                              `}
                            >
                              {status.label}
                            </span>

                          </td>

                          {/* ACTIONS */}

                          <td className="px-4 py-4">

                            <div className="flex items-center gap-2">

                              <Link
                                href={`/policies/${policy.id}`}
                                className="
                                  inline-flex
                                  items-center
                                  justify-center
                                  rounded-md
                                  border
                                  border-gray-300
                                  bg-white
                                  px-3
                                  py-2
                                  text-xs
                                  font-medium
                                  text-gray-700
                                  transition
                                  hover:border-blue-300
                                  hover:bg-blue-50
                                  hover:text-blue-700
                                "
                              >
                                مشاهده
                              </Link>

                              <Link
                                href={`/policies/new?renewFrom=${policy.id}`}
                                className="
                                  inline-flex
                                  items-center
                                  justify-center
                                  rounded-md
                                  border
                                  border-blue-200
                                  bg-blue-50
                                  px-3
                                  py-2
                                  text-xs
                                  font-medium
                                  text-blue-700
                                  transition
                                  hover:bg-blue-100
                                "
                              >
                                تمدید
                              </Link>

                            </div>

                          </td>

                        </tr>
                      );
                    })}

                  </tbody>
                </table>

              </div>

              {/* Table footer */}

              <div
                className="
                  flex
                  flex-col
                  gap-3
                  border-t
                  border-gray-200
                  bg-gray-50
                  px-5
                  py-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >

                <p className="text-sm text-gray-500">
                  نمایش{" "}
                  <span className="font-semibold text-gray-700">
                    {new Intl.NumberFormat(
                      "fa-IR"
                    ).format(policies.length)}
                  </span>{" "}
                  بیمه‌نامه
                </p>

                <Link
                  href="/policies/new"
                  className="
                    inline-flex
                    items-center
                    justify-center
                    rounded-md
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-blue-600
                    transition
                    hover:bg-blue-50
                    hover:text-blue-700
                  "
                >
                  + ثبت بیمه‌نامه جدید
                </Link>

              </div>

            </section>
          )}

      </div>
    </main>
  );
}