import { ApiError } from "./client-error";

// TODO: Replace with real user selection per ADR-008 (manual user selector UI deferred)
export const CURRENT_USER_ID = 1;

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(CURRENT_USER_ID),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.error?.code ?? "UNKNOWN_ERROR",
      body.error?.details,
      body.error?.message ?? response.statusText
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
