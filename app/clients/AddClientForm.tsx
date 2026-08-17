"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddClientForm() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");

  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");

    const { error } = await supabase.from("clients").insert({
      full_name: fullName,
      id_number: idNumber,
      mobile: mobile,
      address: address,
    });

    if (error) {
      if (error.code === "23505") {
        setMessage("مشتری با این کد ملی از قبل وجود دارد.");
      } else {
        setMessage("افزودن مشتری با خطا مواجه شد.");
      }

      return;
    }

    setMessage("مشتری با موفقیت اضافه شد.");

    setFullName("");
    setIdNumber("");
    setMobile("");
    setAddress("");

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 max-w-md space-y-4"
      dir="rtl"
    >
      <div>
        <label className="mb-1 block font-medium">
          نام و نام خانوادگی
        </label>

        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block font-medium">
          کد ملی
        </label>

        <input
          type="text"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block font-medium">
          شماره موبایل
        </label>

        <input
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block font-medium">
          آدرس
        </label>

        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-md border border-gray-300 p-2"
          rows={4}
          required
        />
      </div>

      <button
        type="submit"
        className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
      >
        افزودن مشتری
      </button>

      {message && (
        <p className="mt-2">
          {message}
        </p>
      )}
    </form>
  );
}