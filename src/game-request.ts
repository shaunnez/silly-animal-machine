import { assetUrl, browserStorage } from "./asset-url";
import type { createBrowserStore } from "./browser-store";
let store: Promise<ReturnType<typeof createBrowserStore>> | undefined;
export async function gameRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  if (browserStorage && url.startsWith("/api/")) {
    store ??= import("./browser-store").then(({ createBrowserStore }) =>
      createBrowserStore(indexedDB),
    );
    return (await store).request<T>(url, init);
  }
  const response = await fetch(assetUrl(url), init);
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "Something went wrong. Please try again.");
  return value as T;
}
