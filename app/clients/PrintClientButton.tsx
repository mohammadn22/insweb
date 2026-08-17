"use client";

export default function PrintClientButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="no-print rounded-md bg-black px-5 py-2 text-white hover:bg-gray-800"
    >
      ذخیره به عنوان PDF
    </button>
  );
}