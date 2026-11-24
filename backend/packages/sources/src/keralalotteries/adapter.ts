import { DrawRef, ParsedDraw } from "@gacha/shared";
import { SourceAdapter } from "../types.js";
import { PoliteHttpClient, defaultHttpClient } from "../http.js";
import { parseArticle, parseListing } from "./parser.js";

export const KERALALOTTERIES_HOME_URL = "https://www.keralalotteries.net/";

export class KeralalotteriesNetAdapter implements SourceAdapter {
  readonly id = "keralalotteries_net" as const;
  readonly name = "Kerala Lotteries Net";

  constructor(private http: PoliteHttpClient = defaultHttpClient) {}

  async discover(): Promise<DrawRef[]> {
    const res = await this.http.get(KERALALOTTERIES_HOME_URL);
    return parseListing(res.body);
  }

  async fetchAndParse(refOrUrl: DrawRef | string): Promise<ParsedDraw> {
    const url = typeof refOrUrl === "string" ? refOrUrl : refOrUrl.url;
    const res = await this.http.get(url);
    return parseArticle(res.body, url);
  }
}

export const keralalotteriesAdapter = new KeralalotteriesNetAdapter();
