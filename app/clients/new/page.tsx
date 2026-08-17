"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewClientPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setErrorMessage("");

    const cleanFullName = fullName.trim();
    const cleanIdNumber = idNumber.trim();
    const cleanMobile = mobile.trim();
    const cleanAddress = address.trim();

    if (!cleanFullName) {
      setErrorMessage("لطفاً نام و نام خانوادگی مشتری را وارد کنید.");
      return;
    }

    if (!cleanIdNumber) {
      setErrorMessage("لطفاً شماره شناسایی مشتری را وارد کنید.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("clients")
        .insert({
          full_name: cleanFullName,
          id_number: cleanIdNumber,
          mobile: cleanMobile || null,
          address: cleanAddress || null,
        });

      if (error) {
        // Handle duplicate ID number in a user-friendly way
        if (error.code === "23505") {
          throw new Error(
            "مشتری‌ای با این شماره شناسایی قبلاً ثبت شده است."
          );
        }

        throw new Error(error.message);
      }

      router.push("/clients");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "خطایی هنگام ثبت مشتری رخ داد."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F5F5F5] px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-4xl">

        {/* Header */}

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
            <Link
              href="/"
              className="transition hover:text-[#0066CC]"
            >
              داشبورد
            </Link>

            <span>/</span>

            <Link
              href="/clients"
              className="transition hover:text-[#0066CC]"
            >
              مشتریان
            </Link>

            <span>/</span>

            <span className="font-medium text-gray-700">
              مشتری جدید
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-bold leading-tight text-[#1A1A1A] sm:text-4xl">
              افزودن مشتری جدید
            </h1>

            <p className="mt-3 text-base leading-7 text-[#666666]">
              اطلاعات مشتری را وارد کنید تا یک پرونده جدید
              برای او ایجاد شود.
            </p>
          </div>
        </div>

        {/* Form Card */}

        <section className="rounded-lg border border-[#E0E0E0] bg-white p-5 shadow-sm sm:p-8">

          <div className="mb-7 border-b border-[#E0E0E0] pb-5">
            <h2 className="text-xl font-semibold text-[#1A1A1A]">
              اطلاعات مشتری
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#666666]">
              اطلاعات پایه مشتری را وارد کنید. موارد دارای
              علامت * الزامی هستند.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* Name + ID */}

            <div className="grid gap-6 md:grid-cols-2">

              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-[#1A1A1A]"
                >
                  نام و نام خانوادگی
                  <span className="mr-1 text-[#E74C3C]">
                    *
                  </span>
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  placeholder="مثلاً محمد یوسفی‌زاده"
                  autoComplete="name"
                  disabled={saving}
                  className="w-full rounded-md border border-[#D0D0D0] bg-white px-4 py-3 text-base text-[#1A1A1A] outline-none transition placeholder:text-gray-400 focus:border-[#0066CC] focus:ring-4 focus:ring-[#0066CC]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="idNumber"
                  className="mb-2 block text-sm font-medium text-[#1A1A1A]"
                >
                  شماره ملی
                  <span className="mr-1 text-[#E74C3C]">
                    *
                  </span>
                </label>

                <input
                  id="idNumber"
                  type="text"
                  value={idNumber}
                  onChange={(e) =>
                    setIdNumber(e.target.value)
                  }
                  placeholder="شماره ملی مشتری"
                  autoComplete="off"
                  disabled={saving}
                  className="w-full rounded-md border border-[#D0D0D0] bg-white px-4 py-3 text-base text-[#1A1A1A] outline-none transition placeholder:text-gray-400 focus:border-[#0066CC] focus:ring-4 focus:ring-[#0066CC]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                  required
                />
              </div>

            </div>

            {/* Mobile */}

            <div>
              <label
                htmlFor="mobile"
                className="mb-2 block text-sm font-medium text-[#1A1A1A]"
              >
                شماره موبایل
              </label>

              <input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value)
                }
                placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷"
                autoComplete="tel"
                disabled={saving}
                className="w-full rounded-md border border-[#D0D0D0] bg-white px-4 py-3 text-base text-[#1A1A1A] outline-none transition placeholder:text-gray-400 focus:border-[#0066CC] focus:ring-4 focus:ring-[#0066CC]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
              />

              <p className="mt-2 text-sm text-[#666666]">
                برای تماس و پیگیری مشتری استفاده می‌شود.
              </p>
            </div>

            {/* Address */}

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium text-[#1A1A1A]"
              >
                آدرس
              </label>

              <textarea
                id="address"
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
                placeholder="آدرس مشتری را وارد کنید..."
                rows={4}
                disabled={saving}
                className="w-full resize-y rounded-md border border-[#D0D0D0] bg-white px-4 py-3 text-base leading-7 text-[#1A1A1A] outline-none transition placeholder:text-gray-400 focus:border-[#0066CC] focus:ring-4 focus:ring-[#0066CC]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            {/* Error */}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-md border border-[#E74C3C]/30 bg-red-50 px-4 py-3 text-sm leading-6 text-[#C0392B]"
              >
                <div className="font-medium">
                  ثبت مشتری انجام نشد
                </div>

                <div className="mt-1">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Divider */}

            <div className="border-t border-[#E0E0E0] pt-6">

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-start">

                <Link
                  href="/clients"
                  className="inline-flex items-center justify-center rounded-md border border-[#D0D0D0] bg-white px-6 py-3 text-base font-medium text-[#2C3E50] transition hover:bg-[#F5F5F5] focus:outline-none focus:ring-4 focus:ring-gray-200"
                >
                  انصراف
                </Link>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md bg-[#0066CC] px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-[#0052A3] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#0066CC]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span
                        className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                        aria-hidden="true"
                      />
                      در حال ثبت...
                    </>
                  ) : (
                    "ثبت مشتری"
                  )}
                </button>

              </div>

            </div>

          </form>
        </section>

        {/* Help */}

        <p className="mt-5 text-center text-sm text-gray-500">
          پس از ثبت، می‌توانید برای این مشتری بیمه‌نامه جدید
          ایجاد کنید.
        </p>

      </div>
    </main>
  );
}