import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Insurance Policies
          </h1>

          <p className="mt-2 text-gray-600">
            Manage your clients&apos; insurance policies.
          </p>
        </div>

        <Link
          href="/policies/new"
          className="rounded-md bg-black px-5 py-2 text-white hover:bg-gray-800"
        >
          Add Policy
        </Link>
      </div>

      {error && (
        <p className="mt-6 text-red-600">
          Failed to load policies: {error.message}
        </p>
      )}

      {!error && (!policies || policies.length === 0) && (
        <p className="mt-6 text-gray-600">
          No policies found.
        </p>
      )}

      {policies && policies.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">
                  Client
                </th>

                <th className="border p-3 text-left">
                  Policy Number
                </th>

                <th className="border p-3 text-left">
                  Policy Type
                </th>

                <th className="border p-3 text-left">
                  Start Date
                </th>

                <th className="border p-3 text-left">
                  End Date
                </th>

                <th className="border p-3 text-left">
                  Total Price
                </th>
<th className="border p-3 text-left">
  Actions
</th>
              </tr>
            </thead>

            <tbody>
              {policies.map((policy) => {
                const client = Array.isArray(policy.clients)
                  ? policy.clients[0]
                  : policy.clients;

                return (
                  <tr key={policy.id}>
                    <td className="border p-3">
                      {client?.full_name || "Unknown"}
                    </td>

                    <td className="border p-3">
  <Link
    href={`/policies/${policy.id}`}
    className="underline font-medium"
  >
    {policy.policy_number}
  </Link>
</td>

                    <td className="border p-3">
                      {policy.policy_type}
                    </td>

                    <td className="border p-3">
                      {policy.start_date}
                    </td>

                    <td className="border p-3">
                      {policy.end_date}
                    </td>

                    <td className="border p-3">
                      {new Intl.NumberFormat("en-US").format(
                        Number(policy.total_price)
                      )}
                    </td>
<td className="border p-3">
  <Link
    href={`/policies/new?renewFrom=${policy.id}`}
    className="underline"
  >
    Renew
  </Link>
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}