"use client";

import { useUser, type UserRow } from "@/lib/api/users";

// Rev 1: user is hardcoded — manual user selection is deferred (ADR-008)
const CURRENT_USER_ID = 1;

export function useCurrentUser(): { user: UserRow | undefined; isLoading: boolean } {
  const { data: user, isLoading } = useUser(CURRENT_USER_ID);
  return { user, isLoading };
}
