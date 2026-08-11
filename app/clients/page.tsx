import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddClientForm from "./AddClientForm";
import ClientSearch from "./ClientSearch";
import EditClientForm from "./EditClientForm";
import DeleteClientButton from "./DeleteClientButton";

type ClientsPageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function Clients({ searchParams }: ClientsPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search?.trim() || "";

  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,id_number.ilike.%${search}%,mobile.ilike.%${search}%`
    );
  }

  const { data: clients, error } = await query;

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

      {!error && clients?.length === 0 && (
        <p className="mt-4 text-gray-600">
          No clients found.
        </p>
      )}

      {clients && clients.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">Full Name</th>
                <th className="border p-3 text-left">ID Number</th>
                <th className="border p-3 text-left">Mobile</th>
                <th className="border p-3 text-left">Address</th>
                <th className="border p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="border p-3">{client.full_name}</td>
                  <td className="border p-3">{client.id_number}</td>
                  <td className="border p-3">{client.mobile}</td>
                  <td className="border p-3">{client.address}</td>
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
      )}
    </main>
  );
}