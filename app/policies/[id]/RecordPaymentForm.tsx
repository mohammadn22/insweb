"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RecordPaymentFormProps = {
  policyId: string;
};

export default function RecordPaymentForm({
  policyId,
}: RecordPaymentFormProps) {
  const supabase = createClient();

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage("Payment amount must be greater than zero.");
      return;
    }

    if (!paymentDate) {
      setMessage("Please select a payment date.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc(
        "record_policy_payment",
        {
          p_policy_id: policyId,
          p_amount: numericAmount,
          p_payment_date: paymentDate,
          p_payment_method: paymentMethod,
          p_description: description.trim() || null,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setMessage("Payment recorded successfully.");

      setAmount("");
      setDescription("");

      // Refresh the server-rendered policy details.
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold">
        Record Payment
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-4 max-w-xl space-y-4"
      >
        <label className="block">
          <span className="block text-sm font-medium">
            Amount
          </span>

          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border p-2"
            required
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium">
            Payment date
          </span>

          <input
            type="date"
            value={paymentDate}
            onChange={(e) =>
              setPaymentDate(e.target.value)
            }
            className="mt-1 w-full rounded-md border p-2"
            required
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium">
            Payment method
          </span>

          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value)
            }
            className="mt-1 w-full rounded-md border p-2"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">
              Bank Transfer
            </option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium">
            Description
          </span>

          <input
            type="text"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            placeholder="Optional"
            className="mt-1 w-full rounded-md border p-2"
          />
        </label>

        {message && (
          <p
            className={
              message.includes("successfully")
                ? "text-green-600"
                : "text-red-600"
            }
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-5 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Record Payment"}
        </button>
      </form>
    </section>
  );
}