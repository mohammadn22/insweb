"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EditPaymentFormProps = {
  transactionId: string;
  initialAmount: number;
  initialPaymentDate: string;
  initialPaymentMethod: string;
  initialDescription: string;
  onCancel: () => void;
  onSaved: () => void;
};

export default function EditPaymentForm({
  transactionId,
  initialAmount,
  initialPaymentDate,
  initialPaymentMethod,
  initialDescription,
  onCancel,
  onSaved,
}: EditPaymentFormProps) {
  const supabase = createClient();

  const [amount, setAmount] = useState(
    String(initialAmount)
  );

  const [paymentDate, setPaymentDate] = useState(
    initialPaymentDate
  );

  const [paymentMethod, setPaymentMethod] = useState(
    initialPaymentMethod
  );

  const [description, setDescription] = useState(
    initialDescription || ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setMessage(
        "Payment amount must be greater than zero."
      );
      return;
    }

    if (!paymentDate) {
      setMessage("Please select a payment date.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc(
        "update_policy_payment",
        {
          p_transaction_id: transactionId,
          p_amount: numericAmount,
          p_payment_date: paymentDate,
          p_payment_method: paymentMethod,
          p_description:
            description.trim() || null,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setMessage(
        "Payment updated successfully."
      );

      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border bg-gray-50 p-5">

      <h3 className="text-lg font-semibold">
        Edit Payment
      </h3>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-4 md:grid-cols-2"
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
            onChange={(e) =>
              setAmount(e.target.value)
            }
            className="mt-1 w-full rounded-md border bg-white p-2"
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
            className="mt-1 w-full rounded-md border bg-white p-2"
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
            className="mt-1 w-full rounded-md border bg-white p-2"
          >
            <option value="cash">
              Cash
            </option>

            <option value="card">
              Card
            </option>

            <option value="bank_transfer">
              Bank Transfer
            </option>

            <option value="other">
              Other
            </option>
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
            className="mt-1 w-full rounded-md border bg-white p-2"
          />
        </label>

        {message && (
          <div className="md:col-span-2">
            <p
              className={
                message.includes("successfully")
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {message}
            </p>
          </div>
        )}

        <div className="flex gap-2 md:col-span-2">

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-black px-5 py-2 text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border bg-white px-5 py-2 disabled:opacity-50"
          >
            Cancel
          </button>

        </div>

      </form>

    </div>
  );
}