import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * fetch() has no built-in timeout - on a bad connection a request can hang far
 * longer than a user will wait. This aborts it after `timeoutMs` so callers can
 * treat "hung" the same as "failed" (e.g. queue the message for retry) instead
 * of leaving the UI stuck on a spinner indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
