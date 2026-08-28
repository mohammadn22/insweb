import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type Debtor = {
  client_id: string;
  full_name: string;
  id_number: string;
  mobile: string | null;
  total_policies: number;
  policies_with_debt: number;
  total_outstanding: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function DebtorsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("client_accounting")
    .select("*")
    .gt("total_outstanding", 0)
    .order("total_outstanding", {
      ascending: false,
    });

  const debtors = (data || []) as Debtor[];

  const totalDebt = debtors.reduce(
    (sum, debtor) =>
      sum + Number(debtor.total_outstanding),
    0
  );

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            All Debtors
          </h1>

          <p className="mt-2 text-gray-600">
            Clients with outstanding balances.
          </p>
        </div>

        <Link
          href="/accounting"
          className="border px-4 py-2 rounded-md"
        >
          Accounting Dashboard
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          Failed to load debtors: {error.message}
        </div>
      )}

      {!error && (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-5">
              <p className="text-sm text-gray-500">
                Clients With Debt
              </p>

              <p className="mt-2 text-3xl font-bold">
                {debtors.length}
              </p>
            </div>

            <div className="rounded-lg border p-5">
              <p className="text-sm text-gray-500">
                Total Outstanding
              </p>

              <p className="mt-2 text-3xl font-bold">
                {formatMoney(totalDebt)}
              </p>
            </div>
          </div>

          {debtors.length === 0 ? (
            <div className="mt-8 rounded-lg border p-6 text-gray-600">
              No clients currently owe money.
            </div>
          ) : (
            <section className="mt-8">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-3 text-left">
                        Client
                      </th>

                      <th className="border p-3 text-left">
                        ID Number
                      </th>

                      <th className="border p-3 text-left">
                        Mobile
                      </th>

                      <th className="border p-3 text-left">
                        Policies
                      </th>

                      <th className="border p-3 text-left">
                        Policies With Debt
                      </th>

                      <th className="border p-3 text-left">
                        Total Debt
                      </th>

                      <th className="border p-3 text-left">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {debtors.map((debtor) => (
                      <tr key={debtor.client_id}>
                        <td className="border p-3 font-medium">
                          {debtor.full_name}
                        </td>

                        <td className="border p-3">
                          {debtor.id_number}
                        </td>

                        <td className="border p-3">
                          {debtor.mobile || "-"}
                        </td>

                        <td className="border p-3">
                          {Number(
                            debtor.total_policies
                          )}
                        </td>

                        <td className="border p-3">
                          {Number(
                            debtor.policies_with_debt
                          )}
                        </td>

                        <td className="border p-3 font-semibold">
                          {formatMoney(
                            Number(
                              debtor.total_outstanding
                            )
                          )}
                        </td>

                        <td className="border p-3">
                          <Link
                            href={`/accounting/clients/${debtor.client_id}`}
                            className="underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}