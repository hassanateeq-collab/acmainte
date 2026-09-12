import { redirect } from "next/navigation";

// Transfers were folded into the richer "Move" page.
export default function TransfersPage() {
  redirect("/move");
}
