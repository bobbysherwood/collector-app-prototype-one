import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pickBestPopulationMatch, scorePopulationCandidate } from "@/lib/card-population-lookup/match";
import { parsePsaSearchTableHtml } from "@/lib/card-population-lookup/parse-psa-html";
import { buildPopulationSearchQuery } from "@/lib/card-population-lookup/query";
import {
  formatPopulationPocReport,
  runPopulationLookupPoc,
} from "@/lib/card-population-lookup/run-poc";
import { SAMPLE_POPULATION_CARDS } from "@/lib/card-population-lookup/sample-cards";

const FIXTURE = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/card-population-lookup/__fixtures__/psa-prizm-2023-wembanyama.html"
  ),
  "utf8"
);

describe("population lookup POC", () => {
  it("parses a PSA-style HTML table into candidates", () => {
    const rows = parsePsaSearchTableHtml(FIXTURE, "2023-24 Panini Prizm Basketball");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      cardNumber: "1",
      subject: "Victor Wembanyama",
      variety: "Base",
      counts: { psa_10: 1244 },
    });
    expect(rows[1]?.variety).toBe("Silver");
  });

  it("auto-accepts an exact base card and the matching silver parallel", () => {
    const results = runPopulationLookupPoc(SAMPLE_POPULATION_CARDS);
    expect(results[0]?.match?.decision).toBe("auto");
    expect(results[0]?.match?.candidate.variety).toBe("Base");
    expect(results[0]?.match?.candidate.counts.psa_10).toBe(1244);

    expect(results[1]?.match?.decision).toBe("auto");
    expect(results[1]?.match?.candidate.variety).toBe("Silver");
    expect(results[1]?.match?.candidate.counts.psa_10).toBe(96);
  });

  it("rejects a same-number different-player collision", () => {
    const results = runPopulationLookupPoc(SAMPLE_POPULATION_CARDS);
    expect(results[2]?.match?.decision).toBe("reject");
  });

  it("sends a review decision when the set name is weak but identity locks", () => {
    const match = scorePopulationCandidate(SAMPLE_POPULATION_CARDS[0]!, {
      grader: "PSA",
      setName: "2023 Basketball",
      year: 2023,
      cardNumber: "1",
      subject: "Victor Wembanyama",
      variety: "Base",
      counts: { psa_10: 10 },
    });
    expect(match.decision).toBe("review");
  });

  it("builds grader search URLs from catalog identity", () => {
    const query = buildPopulationSearchQuery(SAMPLE_POPULATION_CARDS[0]!, "PSA");
    expect(query.url).toContain("psacard.com/pop/search");
    expect(query.q).toContain("Wembanyama");
    expect(query.q).toContain("#1");
  });

  it("prints a dry-run report", () => {
    const report = formatPopulationPocReport(runPopulationLookupPoc());
    expect(report).toContain("auto=");
    expect(report).not.toContain("WRITE");
  });

  it("does not invent a match when the table is empty", () => {
    expect(pickBestPopulationMatch(SAMPLE_POPULATION_CARDS[0]!, [])).toBeNull();
  });
});
