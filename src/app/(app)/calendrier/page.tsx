import { redirect } from "next/navigation";

/** Ancienne route : tout est regroupé sous /conges */
export default function CalendrierRedirectPage() {
  redirect("/conges?tab=calendrier");
}
