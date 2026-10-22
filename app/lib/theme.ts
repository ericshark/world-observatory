export const THEME_STORAGE_KEY = "theme";

/** Fires when the effective theme may have changed: an explicit choice or an OS switch. */
export function subscribeThemeChange(listener: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  media.addEventListener("change", listener);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", listener);
  };
}

export function readCssColor(
  name: string,
  element: Element = document.documentElement,
): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}
