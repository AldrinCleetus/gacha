import { DrawRef, ParsedDraw } from "@gacha/shared";
import { SourceAdapter } from "../types.js";
import { PoliteHttpClient, defaultHttpClient } from "../http.js";
import { parseArticle, parseListing } from "./parser.js";

export const ONMANORAMA_LISTING_URL =
  "https://www.onmanorama.com/topic/general-topics/78/kerala-lottery-results.html";

export class OnmanoramaAdapter implements SourceAdapter {
  readonly id = "onmanorama" as const;
  readonly name = "Onmanorama";

  constructor(private http: PoliteHttpClient = defaultHttpClient) {}

  async discover(): Promise<DrawRef[]> {
    const res = await this.http.get(ONMANORAMA_LISTING_URL);
    return parseListing(res.body);
  }

  async fetchAndParse(refOrUrl: DrawRef | string): Promise<ParsedDraw> {
    const url = typeof refOrUrl === "string" ? refOrUrl : refOrUrl.url;
    const res = await this.http.get(url);
    return parseArticle(res.body, url);
  }
}

export const onmanoramaAdapter = new OnmanoramaAdapter();
