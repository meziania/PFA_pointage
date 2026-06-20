"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRapportPointageRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div className="grid min-h-[40dvh] place-items-center text-sm text-muted-foreground">
      Redirection vers le dashboard…
    </div>
  );
}
