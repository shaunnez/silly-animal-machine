/** Runtime public files also work below a GitHub Pages project path. */
export function assetUrl(
  path: string,
  base = import.meta.env?.BASE_URL ?? "/",
) {
  return path.startsWith("/assets/") ? `${base}${path.slice(1)}` : path;
}
export const browserStorage = import.meta.env?.VITE_STORAGE_MODE === "browser";
