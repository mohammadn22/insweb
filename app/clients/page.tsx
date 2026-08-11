import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddClientForm from "./AddClientForm";
import ClientSearch from "./ClientSearch";
import EditClientForm from "./EditClientForm";
import DeleteClientButton from "./DeleteClientButton";

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

  const from = (currentPage - 1) * CLIENTS_PER_PAGE;
  const to = from + CLIENTS_PER_PAGE - 1;

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
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
    Math.ceil(totalClients / CLIENTS_PER_PAGE)
  );

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Clients</h1>

      <AddClientForm />

      <ClientSearch />

      {error && (
        <p className="mt-4 text-red-600">
          Failed to load clients.
        </p>
      )}

      {!error && totalClients === 0 && (
        <p className="mt-4 text-gray-600">
          No clients found.
        </p>
      )}

      {clients && clients.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">
                    Full Name
                  </th>

                  <th className="border p-3 text-left">
                    ID Number
                  </th>

                  <th className="border p-3 text-left">
                    Mobile
                  </th>

                  <th className="border p-3 text-left">
                    Address
                  </th>

                  <th className="border p-3 text-left">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="border p-3">
                      {client.full_name}
                    </td>

                    <td className="border p-3">
                      {client.id_number}
                    </td>

                    <td className="border p-3">
                      {client.mobile}
                    </td>

                    <td className="border p-3">
                      {client.address}
                    </td>

                    <td className="border p-3">
                      <div className="flex gap-3">
                        <details>
                          <summary className="cursor-pointer font-medium">
                            Edit
                          </summary>

                          <EditClientForm client={client} />
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

          <div className="mt-6 flex items-center justify-between">
            <p className="text-gray-600">
              Showing page {currentPage} of {totalPages}
            </p>

            <div className="flex gap-2">
              {currentPage > 1 && (
                <a
                  href={`/clients?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    page: String(currentPage - 1),
                  }).toString()}`}
                  className="border px-4 py-2 rounded-md"
                >
                  Previous
                </a>
              )}

              {currentPage < totalPages && (
                <a
                  href={`/clients?${new URLSearchParams({
                    ...(search ? { search } : {}),
                    page: String(currentPage + 1),
                  }).toString()}`}
                  className="border px-4 py-2 rounded-md"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}