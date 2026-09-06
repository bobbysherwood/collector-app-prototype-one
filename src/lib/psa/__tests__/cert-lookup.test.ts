import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearPsaCertCache,
  fetchPsaCertByNumber,
  getPsaPublicApiToken,
  psaCertLookupUrl,
} from "@/lib/psa/cert-lookup";
import {
  interpretPsaCertResponse,
  mapPsaCategoryToSport,
  mapPsaGrade,
  normalizePsaCertNumber,
  parsePsaCertPayload,
  psaCertToFormPrefill,
} from "@/lib/psa/map-cert";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src/lib/psa/__fixtures__/${name}`),
      "utf8"
    )
  ) as unknown;
}

afterEach(() => {
  clearPsaCertCache();
});

describe("normalizePsaCertNumber", () => {
  it("accepts digit certs and strips spaces", () => {
    expect(normalizePsaCertNumber(" 12 345 678 ")).toBe("12345678");
  });

  it("rejects short or non-numeric values", () => {
    expect(normalizePsaCertNumber("abc")).toBeNull();
    expect(normalizePsaCertNumber("12")).toBeNull();
  });
});

describe("PSA cert mapping", () => {
  it("maps a successful public-api payload onto the add-asset fields", () => {
    const result = interpretPsaCertResponse(200, loadFixture("cert-success.json"));
    expect(result.status).toBe("found");
    if (result.status !== "found") return;

    expect(result.cert).toMatchObject({
      certNumber: "12345678",
      subject: "Patrick Mahomes",
      year: 2018,
      cardNumber: "201",
      sport: "Football",
      grade: "10",
      brand: "2018 Panini Prizm",
      variety: "Silver",
    });

    expect(psaCertToFormPrefill(result.cert)).toMatchObject({
      player_name: "Patrick Mahomes",
      player_id: null,
      year: 2018,
      sport: "Football",
      card_number: "201",
      grader: "PSA",
      grade: "10",
      cert_number: "12345678",
    });
    expect(psaCertToFormPrefill(result.cert).insert_parallel).toBeUndefined();
  });

  it("reads live aliases such as YearIssued", () => {
    const cert = parsePsaCertPayload({
      certNumber: 87654321,
      subject: "Shohei Ohtani",
      yearIssued: "2023",
      cardNumber: "17",
      category: "Baseball Cards",
      cardGrade: "MINT 9",
    });
    expect(cert).toMatchObject({
      certNumber: "87654321",
      year: 2023,
      sport: "Baseball",
      grade: "9",
    });
  });

  it("explains a 403 from an unapproved public API token", () => {
    expect(interpretPsaCertResponse(403, { Message: "Access to this API is limited to approved customers." })).toEqual({
      status: "error",
      message:
        "PSA rejected this API token. The free public cert API appears to have been shut down — email collectors-apis@collectors.com.",
    });
  });

  it("treats invalid and empty certs as non-hits", () => {
    expect(interpretPsaCertResponse(200, loadFixture("cert-invalid.json"))).toEqual({
      status: "invalid",
      message: "PSA did not recognize that cert number.",
    });
    expect(interpretPsaCertResponse(200, loadFixture("cert-not-found.json"))).toEqual({
      status: "not_found",
      message: "That cert number was not found.",
    });
    expect(interpretPsaCertResponse(204, null).status).toBe("not_found");
  });

  it("maps categories and grades used on slabs", () => {
    expect(mapPsaCategoryToSport("Basketball Cards")).toBe("Basketball");
    expect(mapPsaCategoryToSport("Pokémon")).toBe("Pokemon");
    expect(mapPsaCategoryToSport("Non-Sports")).toBe("Other");
    expect(mapPsaGrade("GEM MT 10")).toBe("10");
    expect(mapPsaGrade("NM-MT 8")).toBe("8");
    expect(mapPsaGrade("AUTH")).toBe("Authentic");
  });
});

describe("fetchPsaCertByNumber", () => {
  it("does not call PSA when the cert format is invalid", async () => {
    const fetchFn = async () => {
      throw new Error("should not fetch");
    };
    await expect(
      fetchPsaCertByNumber("nope", { token: "secret", fetch: fetchFn })
    ).resolves.toEqual({
      status: "invalid",
      message: "Enter a valid PSA cert number.",
    });
  });

  it("sends a bearer token and caches a found cert", async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push(String(input));
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("bearer secret-token");
      return new Response(JSON.stringify(loadFixture("cert-success.json")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const first = await fetchPsaCertByNumber("12345678", {
      token: "secret-token",
      fetch: fetchFn,
    });
    const second = await fetchPsaCertByNumber("12345678", {
      token: "secret-token",
      fetch: fetchFn,
    });

    expect(first.status).toBe("found");
    expect(second.status).toBe("found");
    expect(calls).toEqual([psaCertLookupUrl("12345678")]);
  });

  it("does not read a live token from the environment in tests", () => {
    expect(getPsaPublicApiToken({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("strips quotes and a pasted Bearer prefix from the env token", () => {
    expect(
      getPsaPublicApiToken({
        PSA_PUBLIC_API_TOKEN: 'Bearer "abc123"',
      } as NodeJS.ProcessEnv)
    ).toBe("abc123");
  });
});
