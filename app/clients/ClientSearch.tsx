"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ClientSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") || "";

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const search = formData.get("search")?.toString().trim() || "";

    const params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    const queryString = params.toString();

    router.push(queryString ? `/clients?${queryString}` : "/clients");
  }

  return (
    <form onSubmit={handleSearch} className="mt-6 flex gap-2 max-w-2xl">
      <input
        type="text"
        name="search"
        defaultValue={currentSearch}
        placeholder="Search by name, ID number, or mobile..."
        className="flex-1 border border-gray-300 rounded-md p-2"
      />

      <button
        type="submit"
        className="bg-black text-white px-5 py-2 rounded-md hover:bg-gray-800"
      >
        Search
      </button>
    </form>
  );
}