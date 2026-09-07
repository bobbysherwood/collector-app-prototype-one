import { describe, expect, it } from "vitest";
import { leftoverSearchTokens, parsePopulationSearchTokens } from "@/lib/dm2-card-population-search";

describe("catalog search helpers used by Market Research", () => {
  it("keeps prizm as a set/brand token after a player name is consumed", () => {
    const { textTokens } = parsePopulationSearchTokens("lebron prizm");
    expect(leftoverSearchTokens(textTokens, ["LeBron James"])).toContain("prizm");
  });
});
