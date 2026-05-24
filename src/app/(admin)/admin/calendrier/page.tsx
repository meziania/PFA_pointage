import { redirect } from "next/navigation";

export default function AdminCalendrierRedirectPage() {
  redirect("/admin/conges?tab=calendrier");
}
