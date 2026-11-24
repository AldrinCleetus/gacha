import { describe, expect, it } from "vitest";
import { isSingleSourcePublishEnabled } from "../publish.js";

describe("Publishing Configuration & State Rules", () => {
  it("disables single-source publish by default in F9+ when env is unset", () => {
    delete process.env.SINGLE_SOURCE_PUBLISH;
    expect(isSingleSourcePublishEnabled()).toBe(false);

    process.env.SINGLE_SOURCE_PUBLISH = "true";
    expect(isSingleSourcePublishEnabled()).toBe(true);
  });

  it("disables single-source publish when SINGLE_SOURCE_PUBLISH is 'false'", () => {
    process.env.SINGLE_SOURCE_PUBLISH = "false";
    expect(isSingleSourcePublishEnabled()).toBe(false);
  });
});
