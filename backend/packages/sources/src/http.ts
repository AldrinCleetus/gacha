import { HttpResponse, HttpOptions } from "./types.js";

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  body: string;
  headers: Record<string, string>;
}

export class PoliteHttpClient {
  private userAgent: string;
  private minIntervalMs: number;
  private lastRequestTimeByHost: Map<string, number> = new Map();
  private cache: Map<string, CacheEntry> = new Map();

  constructor(options?: { userAgent?: string; minIntervalMs?: number }) {
    this.userAgent =
      options?.userAgent ||
      "gacha-bot/1.0 (+https://github.com/project-gacha; bot@gacha.local)";
    this.minIntervalMs = options?.minIntervalMs ?? 2000;
  }

  private async rateLimit(hostname: string): Promise<void> {
    const last = this.lastRequestTimeByHost.get(hostname) || 0;
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTimeByHost.set(hostname, Date.now());
  }

  async get(urlStr: string, options?: HttpOptions): Promise<HttpResponse> {
    const url = new URL(urlStr);
    await this.rateLimit(url.hostname);

    const headers: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...options?.headers,
    };

    const cached = this.cache.get(urlStr);
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }
    if (cached?.lastModified) {
      headers["If-Modified-Since"] = cached.lastModified;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 15000);

    try {
      const res = await fetch(urlStr, {
        headers,
        signal: controller.signal,
      });

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key.toLowerCase()] = val;
      });

      if (res.status === 304 && cached) {
        return {
          url: urlStr,
          status: 304,
          statusText: "Not Modified",
          headers: cached.headers,
          body: cached.body,
          notModified: true,
        };
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${urlStr}`);
      }

      const body = await res.text();
      const etag = resHeaders["etag"];
      const lastModified = resHeaders["last-modified"];

      if (etag || lastModified) {
        this.cache.set(urlStr, {
          etag,
          lastModified,
          body,
          headers: resHeaders,
        });
      }

      return {
        url: urlStr,
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body,
        notModified: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const defaultHttpClient = new PoliteHttpClient();
