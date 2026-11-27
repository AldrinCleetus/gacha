import { useEffect } from "react";

export interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

/** Updates document title, canonical link, and OpenGraph / Twitter meta tags per route. */
export function usePageMeta({ title, description, path, image = "/og-image.png", noIndex = false }: PageMetaOptions) {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const origin = window.location.origin;
    const targetUrl = path ? `${origin}${path}` : window.location.href;
    const imageUrl = image.startsWith("http") ? image : `${origin}${image}`;

    document.title = title;

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", targetUrl);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertCanonical(targetUrl);
  }, [title, description, path, image, noIndex]);
}
