import type { DrawRef, ParsedDraw } from "@gacha/shared";

export interface HttpResponse {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  notModified: boolean;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface SourceAdapter {
  id: "onmanorama" | "keralalotteries_net" | "official";
  name: string;
  discover(): Promise<DrawRef[]>;
  fetchAndParse(refOrUrl: DrawRef | string): Promise<ParsedDraw>;
}
