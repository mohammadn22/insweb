import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AddPolicyForm from "../AddPolicyForm";

type NewPolicyPageProps = {
  searchParams: Promise<{
    renewFrom?: string;
  }>;
};

export default async function NewPolicyPage({
  searchParams,
}: NewPolicyPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const renewFrom = params.renewFrom;

  // --------------------------------------------------
  // LOAD CLIENTS
  // --------------------------------------------------

  const { data: clients, error: clientsError } =
    await supabase
      .from("clients")
      .select("id, full_name, id_number")
      .order("full_name");

  if (clientsError) {
    return (
      <main className="p-8">
        <p className="text-red-600">
          Failed to load clients.
        </p>
      </main>
    );
  }

  // --------------------------------------------------
  // LOAD PREVIOUS POLICY FOR RENEWAL
  // --------------------------------------------------

  let renewalData:
    | {
        previousPolicyId: string;
        clientId: string;
        policyType: string;
        policyNumber: string;
      }
    | undefined;

  if (renewFrom) {
    const { data: previousPolicy, error } =
      await supabase
        .from("policies")
        .select(`
          id,
          policy_number,
          policy_type,
          client_id
        `)
        .eq("id", renewFrom)
        .single();

    if (error || !previousPolicy) {
      notFound();
    }

    renewalData = {
      previousPolicyId: previousPolicy.id,
      clientId: previousPolicy.client_id,
      policyType: previousPolicy.policy_type,
      policyNumber: previousPolicy.policy_number,
    };
  }

  return (
    <main className="p-8">
      <div className="mb-8">
        <Link href="/policies">
          ← Back to Policies
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          {renewalData
            ? "Renew Insurance Policy"
            : "Add Insurance Policy"}
        </h1>

        <p className="mt-2 text-gray-600">
          {renewalData
            ? `Create a new policy based on ${renewalData.policyNumber}.`
            : "Create a new insurance policy for an existing client."}
        </p>
      </div>

      {renewalData && (
        <div className="mb-6 rounded-md border bg-gray-50 p-4">
          <p className="font-medium">
            Renewing policy:
          </p>

          <p className="mt-1">
            {renewalData.policyNumber}
          </p>

          <p className="mt-2 text-sm text-gray-600">
            The new policy will have its own payment
            schedule and accounting history.
          </p>
        </div>
      )}

      <AddPolicyForm
        clients={clients ?? []}
        renewalData={renewalData}
      />
    </main>
  );
}