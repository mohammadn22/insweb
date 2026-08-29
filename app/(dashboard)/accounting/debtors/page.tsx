import { redirect } from "next/navigation";

export default function LegacyDebtorsRedirect() {
  redirect("/debtors");
}