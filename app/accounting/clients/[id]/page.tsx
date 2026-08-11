import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type ClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PolicyAccounting = {
  policy_id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  total_price: number;
  total_paid: number;
  outstanding_balance: number;
};

type Transaction = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  description: string | null;
  policy_id: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPolicyStatus(endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(`${endDate}T00:00:00`);

  return end < today ? "Expired" : "Active";
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "cash":
      return "Cash";

    case "bank_transfer":
      return "Bank Transfer";

    case "card":
      return "Card";

    case "other":
      return "Other";

    default:
      return method;
  }
}

export default async function ClientAccountingPage({
  params,
}: ClientPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const { data: client, error: clientError } =
    await supabase
      .from("clients")
      .select(
        "id, full_name, id_number, mobile, address"
      )
      .eq("id", id)
      .single();

  if (clientError || !client) {
    notFound();
  }

  const { data: policies, error: policiesError } =
    await supabase
      .from("policy_accounting")
      .select(`
        policy_id,
        policy_number,
        policy_type,
        start_date,
        end_date,
        total_price,
        total_paid,
        outstanding_balance
      `)
      .eq("client_id", id)
      .order("start_date", {
        ascending: false,
      });

  const policyList =
    (policies || []) as PolicyAccounting[];

  /*
   * Get all transactions belonging to this client.
   */
  const { data: transactions, error: transactionsError } =
    await supabase
      .from("transactions")
      .select(`
        id,
        amount,
        payment_date,
        payment_method,
        description,
        policy_id
      `)
      .eq("client_id", id)
      .order("payment_date", {
        ascending: false,
      });

  const transactionList =
    (transactions || []) as Transaction[];

  const totalPolicyValue = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.total_price),
    0
  );

  const totalPaid = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.total_paid),
    0
  );

  const totalOutstanding = policyList.reduce(
    (sum, policy) =>
      sum + Number(policy.outstanding_balance),
    0
  );

  const transactionTotal = transactionList.reduce(
    (sum, transaction) =>
      sum + Number(transaction.amount),
    0
  );

  /*
   * Create a quick lookup so we can display
   * the policy number next to each transaction.
   */
  const policyNumberMap = new Map(
    policyList.map((policy) => [
      policy.policy_id,
      policy.policy_number,
    ])
  );

  const policiesWithDebt = policyList.filter(
    (policy) =>
      Number(policy.outstanding_balance) > 0
  );

  return (
    <main className="min-h-screen p-8">
      {/* HEADER */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {client.full_name}
          </h1>

          <p className="mt-2 text-gray-600">
            Client accounting
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/accounting/debtors"
            className="border px-4 py-2 rounded-md"
          >
            All Debtors
          </Link>

          <Link
            href="/clients"
            className="border px-4 py-2 rounded-md"
          >
            Clients
          </Link>
        </div>
      </div>

      {/* CLIENT INFORMATION */}

      <section className="mt-8 rounded-lg border p-6">
        <h2 className="text-xl font-semibold">
          Client Information
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">
              Full Name
            </p>

            <p className="font-medium">
              {client.full_name}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              ID Number
            </p>

            <p className="font-medium">
              {client.id_number}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Mobile
            </p>

            <p className="font-medium">
              {client.mobile || "-"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Address
            </p>

            <p className="font-medium">
              {client.address || "-"}
            </p>
          </div>
        </div>
      </section>

      {/* FINANCIAL SUMMARY */}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-5">
          <p className="text-sm text-gray-500">
            Total Policy Value
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatMoney(totalPolicyValue)}
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <p className="text-sm text-gray-500">
            Total Paid
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatMoney(totalPaid)}
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <p className="text-sm text-gray-500">
            Total Outstanding
          </p>

          <p className="mt-2 text-2xl font-bold">
            {formatMoney(totalOutstanding)}
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <p className="text-sm text-gray-500">
            Recorded Transactions
          </p>

          <p className="mt-2 text-2xl font-bold">
            {transactionList.length}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {formatMoney(transactionTotal)} total
          </p>
        </div>
      </section>

      {/* POLICIES */}

      <section className="mt-10">
        <div>
          <h2 className="text-xl font-semibold">
            Policies
          </h2>

          <p className="mt-1 text-gray-600">
            {policiesWithDebt.length} policy
            {policiesWithDebt.length === 1
              ? ""
              : "ies"} currently have outstanding
            balances.
          </p>
        </div>

        {policiesError && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
            Failed to load policies:{" "}
            {policiesError.message}
          </div>
        )}

        {!policiesError &&
          policyList.length === 0 && (
            <div className="mt-4 rounded-lg border p-6 text-gray-600">
              This client has no policies.
            </div>
          )}

        {policyList.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">
                    Policy
                  </th>

                  <th className="border p-3 text-left">
                    Type
                  </th>

                  <th className="border p-3 text-left">
                    Start
                  </th>

                  <th className="border p-3 text-left">
                    End
                  </th>

                  <th className="border p-3 text-left">
                    Status
                  </th>

                  <th className="border p-3 text-left">
                    Total
                  </th>

                  <th className="border p-3 text-left">
                    Paid
                  </th>

                  <th className="border p-3 text-left">
                    Outstanding
                  </th>

                  <th className="border p-3 text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {policyList.map((policy) => {
                  const outstanding =
                    Number(
                      policy.outstanding_balance
                    );

                  return (
                    <tr key={policy.policy_id}>
                      <td className="border p-3">
                        {policy.policy_number}
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
                        {getPolicyStatus(
                          policy.end_date
                        )}
                      </td>

                      <td className="border p-3">
                        {formatMoney(
                          Number(policy.total_price)
                        )}
                      </td>

                      <td className="border p-3">
                        {formatMoney(
                          Number(policy.total_paid)
                        )}
                      </td>

                      <td className="border p-3 font-semibold">
                        {formatMoney(outstanding)}
                      </td>

                      <td className="border p-3">
                        <Link
                          href={`/policies/${policy.policy_id}`}
                          className="underline"
                        >
                          View Policy
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TRANSACTION HISTORY */}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Transaction History
            </h2>

            <p className="mt-1 text-gray-600">
              All payments recorded for this client.
            </p>
          </div>
        </div>

        {transactionsError && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
            Failed to load transactions:{" "}
            {transactionsError.message}
          </div>
        )}

        {!transactionsError &&
          transactionList.length === 0 && (
            <div className="mt-4 rounded-lg border p-6 text-gray-600">
              No transactions recorded for this
              client.
            </div>
          )}

        {transactionList.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">
                    Date
                  </th>

                  <th className="border p-3 text-left">
                    Policy
                  </th>

                  <th className="border p-3 text-left">
                    Amount
                  </th>

                  <th className="border p-3 text-left">
                    Payment Method
                  </th>

                  <th className="border p-3 text-left">
                    Description
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactionList.map(
                  (transaction) => (
                    <tr key={transaction.id}>
                      <td className="border p-3">
                        {transaction.payment_date}
                      </td>

                      <td className="border p-3">
                        {transaction.policy_id
                          ? policyNumberMap.get(
                              transaction.policy_id
                            ) || "Unknown"
                          : "-"}
                      </td>

                      <td className="border p-3 font-semibold">
                        {formatMoney(
                          Number(transaction.amount)
                        )}
                      </td>

                      <td className="border p-3">
                        {formatPaymentMethod(
                          transaction.payment_method
                        )}
                      </td>

                      <td className="border p-3">
                        {transaction.description ||
                          "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}