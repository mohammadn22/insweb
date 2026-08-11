"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
  id_number: string;
  mobile: string;
  address: string;
};

type EditClientFormProps = {
  client: Client;
};

export default function EditClientForm({
  client,
}: EditClientFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(client.full_name);
  const [idNumber, setIdNumber] = useState(client.id_number);
  const [mobile, setMobile] = useState(client.mobile);
  const [address, setAddress] = useState(client.address);

  const [message, setMessage] = useState("");

  async function handleSubmit(
    e: React.SubmitEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: fullName,
        id_number: idNumber,
        mobile: mobile,
        address: address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (error) {
      if (error.code === "23505") {
        setMessage(
          "A client with this ID number already exists."
        );
      } else {
        setMessage("Failed to update client.");
      }

      return;
    }

    setMessage("Client updated successfully!");

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 max-w-md space-y-4"
    >
      <div>
        <label className="block mb-1 font-medium">
          Full Name
        </label>

        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
          required
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">
          ID Number
        </label>

        <input
          type="text"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
          required
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">
          Mobile Phone Number
        </label>

        <input
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
          required
        />
      </div>

      <div>
        <label className="block mb-1 font-medium">
          Address
        </label>

        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2"
          rows={4}
          required
        />
      </div>

      <button
        type="submit"
        className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800"
      >
        Save Changes
      </button>

      {message && (
        <p className="mt-2">
          {message}
        </p>
      )}
    </form>
  );
}