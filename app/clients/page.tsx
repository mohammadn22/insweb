import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddClientForm from "./AddClientForm";
import ClientSearch from "./ClientSearch";
import EditClientForm from "./EditClientForm";
import DeleteClientButton from "./DeleteClientButton";
import ExportClientsButton from "./ExportClientsButton";
import ImportClientsButton from "./ImportClientsButton";

type ClientsPageProps = {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
};

const CLIENTS_PER_PAGE = 20;

export default async function Clients({
  searchParams,
}: ClientsPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const search = params.search?.trim() || "";

  const requestedPage = Number(params.page) || 1;

  const currentPage =
    requestedPage > 0 ? requestedPage : 1;

  const from =
    (currentPage - 1) * CLIENTS_PER_PAGE;

  const to =
    from + CLIENTS_PER_PAGE - 1;

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("created_at", {
      ascending: false,
    })
    .range(from, to);

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,id_number.ilike.%${search}%,mobile.ilike.%${search}%`
    );
  }

  const {
    data: clients,
    error,
    count,
  } = await query;

  const totalClients = count || 0;

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalClients / CLIENTS_PER_PAGE
    )
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <header className="mb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h1 className="text-3xl font-bold leading-tight text-gray-900">
                مشتریان
              </h1>

              <p className="mt-2 text-base leading-6 text-gray-500">
                مدیریت اطلاعات مشتریان و سوابق بیمه‌ای آن‌ها
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <ImportClientsButton />

              <ExportClientsButton />

              <Link
                href="/clients/new"
                className="
                  inline-flex items-center justify-center
                  rounded-lg
                  bg-blue-600
                  px-5 py-3
                  text-sm font-semibold text-white
                  shadow-sm
                  transition
                  hover:bg-blue-700
                  hover:shadow
                  active:bg-blue-800
                "
              >
                + افزودن مشتری جدید
              </Link>

            </div>
          </div>
        </header>

        {/* ADD CLIENT */}

        <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                افزودن مشتری
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                اطلاعات مشتری جدید را وارد کنید.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <AddClientForm />
          </div>

        </section>

        {/* SEARCH + SUMMARY */}

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div className="w-full lg:max-w-2xl">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                جستجوی مشتری
              </label>

              <ClientSearch
                initialSearch={search}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 font-semibold text-blue-700">
                {totalClients}
              </span>

              <span>
                مشتری ثبت شده
              </span>
            </div>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">
              خطا در بارگذاری مشتریان
            </p>

            <p className="mt-1">
              امکان دریافت اطلاعات مشتریان وجود ندارد.
            </p>
          </div>
        )}

        {/* EMPTY STATE */}

        {!error && totalClients === 0 && (
          <section className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
              👤
            </div>

            <h2 className="mt-5 text-lg font-semibold text-gray-900">
              مشتری‌ای پیدا نشد
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              {search
                ? "برای جستجوی خود عبارت دیگری را امتحان کنید."
                : "هنوز هیچ مشتری‌ای در سیستم ثبت نشده است."}
            </p>

            {!search && (
              <Link
                href="/clients/new"
                className="
                  mt-6
                  inline-flex
                  rounded-lg
                  bg-blue-600
                  px-5 py-3
                  text-sm font-semibold text-white
                  transition
                  hover:bg-blue-700
                "
              >
                افزودن اولین مشتری
              </Link>
            )}

          </section>
        )}

        {/* CLIENT TABLE */}

        {!error &&
          clients &&
          clients.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

              {/* TABLE HEADER */}

              <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    فهرست مشتریان
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    اطلاعات مشتریان ثبت‌شده در سیستم
                  </p>
                </div>

                <p className="text-sm text-gray-500">
                  نمایش{" "}
                  <span className="font-semibold text-gray-700">
                    {from + 1}
                  </span>{" "}
                  تا{" "}
                  <span className="font-semibold text-gray-700">
                    {Math.min(
                      to + 1,
                      totalClients
                    )}
                  </span>{" "}
                  از{" "}
                  <span className="font-semibold text-gray-700">
                    {totalClients}
                  </span>
                </p>

              </div>

              {/* RESPONSIVE TABLE */}

              <div className="overflow-x-auto">

                <table className="min-w-full border-collapse">

                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">

                      <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700 sm:px-6">
                        نام و نام خانوادگی
                      </th>

                      <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                        شماره ملی
                      </th>

                      <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                        شماره موبایل
                      </th>

                      <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                        آدرس
                      </th>

                      <th className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-700">
                        عملیات
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="transition hover:bg-gray-50"
                      >

                        {/* NAME */}

                        <td className="px-5 py-4 sm:px-6">

                          <Link
                            href={`/clients/${client.id}`}
                            className="
                              font-semibold
                              text-gray-900
                              transition
                              hover:text-blue-600
                            "
                          >
                            {client.full_name}
                          </Link>

                        </td>

                        {/* ID NUMBER */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                          {client.id_number || "-"}
                        </td>

                        {/* MOBILE */}

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                          {client.mobile || "-"}
                        </td>

                        {/* ADDRESS */}

                        <td className="max-w-xs px-5 py-4 text-sm text-gray-600 sm:px-6">
                          <div className="truncate">
                            {client.address || "-"}
                          </div>
                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-4 sm:px-6">

                          <div className="flex items-center gap-2">

                            <details className="relative">

                              <summary
                                className="
                                  cursor-pointer
                                  list-none
                                  rounded-lg
                                  border
                                  border-gray-200
                                  bg-white
                                  px-3 py-2
                                  text-sm
                                  font-medium
                                  text-gray-700
                                  transition
                                  hover:bg-gray-50
                                  hover:border-gray-300
                                "
                              >
                                ویرایش
                              </summary>

                              <div className="absolute left-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">

                                <EditClientForm
                                  client={client}
                                />

                              </div>

                            </details>

                            <DeleteClientButton
                              clientId={client.id}
                              clientName={client.full_name}
                            />

                          </div>

                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>

              {/* PAGINATION */}

              <div className="flex flex-col gap-4 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

                <p className="text-sm text-gray-500">
                  صفحه{" "}
                  <span className="font-semibold text-gray-700">
                    {currentPage}
                  </span>{" "}
                  از{" "}
                  <span className="font-semibold text-gray-700">
                    {totalPages}
                  </span>
                </p>

                <div className="flex items-center gap-2">

                  {currentPage > 1 ? (
                    <Link
                      href={`/clients?${new URLSearchParams({
                        ...(search
                          ? { search }
                          : {}),
                        page: String(
                          currentPage - 1
                        ),
                      }).toString()}`}
                      className="
                        rounded-lg
                        border
                        border-gray-200
                        bg-white
                        px-4 py-2
                        text-sm
                        font-medium
                        text-gray-700
                        transition
                        hover:bg-gray-50
                      "
                    >
                      قبلی
                    </Link>
                  ) : (
                    <span
                      className="
                        cursor-not-allowed
                        rounded-lg
                        border
                        border-gray-100
                        bg-gray-50
                        px-4 py-2
                        text-sm
                        text-gray-300
                      "
                    >
                      قبلی
                    </span>
                  )}

                  <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    {currentPage}
                  </span>

                  {currentPage < totalPages ? (
                    <Link
                      href={`/clients?${new URLSearchParams({
                        ...(search
                          ? { search }
                          : {}),
                        page: String(
                          currentPage + 1
                        ),
                      }).toString()}`}
                      className="
                        rounded-lg
                        border
                        border-gray-200
                        bg-white
                        px-4 py-2
                        text-sm
                        font-medium
                        text-gray-700
                        transition
                        hover:bg-gray-50
                      "
                    >
                      بعدی
                    </Link>
                  ) : (
                    <span
                      className="
                        cursor-not-allowed
                        rounded-lg
                        border
                        border-gray-100
                        bg-gray-50
                        px-4 py-2
                        text-sm
                        text-gray-300
                      "
                    >
                      بعدی
                    </span>
                  )}

                </div>

              </div>

            </section>
          )}

      </div>
    </main>
  );
}