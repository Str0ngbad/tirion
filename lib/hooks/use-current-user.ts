"use client";

import { useUser, type UserRow } from "@/lib/api/users";
import { CURRENT_USER_ID } from "@/lib/api/client";

export function useCurrentUser(): { user: UserRow | undefined; isLoading: boolean } {
  const { data: user, isLoading } = useUser(CURRENT_USER_ID);
  return { user, isLoading };
}
