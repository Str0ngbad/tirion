"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/api/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session; stable across re-renders
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
