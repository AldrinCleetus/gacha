import type { DrawRef, ParsedDraw } from "@gacha/shared";

export interface SourceAdapter {
  id: "onmanorama" | "keralalotteries_net" | "official";
  discover(): Promise<DrawRef[]>;
  fetchAndParse(ref: DrawRef): Promise<ParsedDraw>;
}
