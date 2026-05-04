"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { initFirebaseAnalytics } from "@/lib/firebase";
import { AuthProvider } from "@/components/providers/auth-provider";

const ReactQueryDevtools = dynamic(
  async () => (await import("@tanstack/react-query-devtools")).ReactQueryDevtools,
  { ssr: false },
);

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="bottom-right" closeButton visibleToasts={2} />
        </ThemeProvider>
      </AuthProvider>
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
    </QueryClientProvider>
  );
}
