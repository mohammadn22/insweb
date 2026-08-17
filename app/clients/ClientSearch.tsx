"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ClientSearchProps = {
  initialSearch: string;
};

export default function ClientSearch({
  initialSearch,
}: ClientSearchProps) {
  const router = useRouter();

  const [search, setSearch] = useState(initialSearch);

  const firstRender = useRef(true);

  useEffect(() => {
    // Do not perform a search when the component first loads.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(
        window.location.search
      );

      if (search.trim()) {
        params.set("search", search.trim());
      } else {
        params.delete("search");
      }

      // Always return to page 1 when search changes.
      params.delete("page");

      const queryString = params.toString();

      router.replace(
        queryString
          ? `/clients?${queryString}`
          : "/clients",
        {
          scroll: false,
        }
      );
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, router]);

  return (
    <div className="mt-6">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="جست‌و‌جوی نام، شماره ملی یا شماره موبایل..."
        className="w-full max-w-md rounded-md border px-3 py-2"
      />
    </div>
  );
}