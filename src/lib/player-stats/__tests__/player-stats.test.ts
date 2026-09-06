import { describe, expect, it } from "vitest";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { buildPlayerOpportunityContextFromIdentity } from "@/lib/player-opportunity/build-player-context";
import {
  derivePlayerProfile,
  deriveQualitySignals,
  formatDraftLine,
  lifecycleFromPublicCareer,
  liveStatsCanScore,
} from "@/lib/player-stats/derive";
import {
  clearNbaCaches,
  parseNbaCareerPerGame,
  parseNbaCommonPlayerInfo,
} from "@/lib/player-stats/nba-stats";
import {
  nbaHeadshotUrl,
  resolvePlayerImageUrl,
  wikimediaFileUrl,
} from "@/lib/player-stats/image";
import {
  clearPlayerLiveStatsCache,
  isBasketballSport,
  isSupportedPlayerStatsSport,
  loadPlayerLiveStats,
} from "@/lib/player-stats/provider";
import {
  clearWikidataCaches,
  parseWikidataSparqlBio,
  pickWikidataSearchHit,
} from "@/lib/player-stats/wikidata";
import type { NbaStatsResponse } from "@/lib/player-stats/types";

const TATUM_INFO: NbaStatsResponse = {
  resultSets: [
    {
      name: "CommonPlayerInfo",
      headers: [
        "PERSON_ID",
        "DISPLAY_FIRST_LAST",
        "BIRTHDATE",
        "SCHOOL",
        "TEAM_CITY",
        "TEAM_NAME",
        "POSITION",
        "FROM_YEAR",
        "TO_YEAR",
        "DRAFT_YEAR",
        "DRAFT_ROUND",
        "DRAFT_NUMBER",
      ],
      rowSet: [
        [
          1628369,
          "Jayson Tatum",
          "1998-03-03T00:00:00",
          "Duke",
          "Boston",
          "Celtics",
          "Forward",
          2017,
          2025,
          "2017",
          1,
          3,
        ],
      ],
    },
  ],
};

const TATUM_CAREER: NbaStatsResponse = {
  resultSets: [
    {
      name: "SeasonTotalsRegularSeason",
      headers: [
        "SEASON_ID",
        "TEAM_ABBREVIATION",
        "GP",
        "MIN",
        "PTS",
        "REB",
        "AST",
        "STL",
        "BLK",
        "TOV",
        "FG_PCT",
        "FG3_PCT",
        "FT_PCT",
      ],
      rowSet: [
        ["2023-24", "BOS", 74, 35.7, 26.9, 8.1, 4.9, 1.0, 0.6, 2.5, 0.471, 0.376, 0.833],
        ["2024-25", "BOS", 72, 36.4, 26.8, 8.7, 6.0, 1.1, 0.5, 2.9, 0.452, 0.343, 0.814],
      ],
    },
    {
      name: "CareerTotalsRegularSeason",
      headers: [
        "SEASON_ID",
        "TEAM_ABBREVIATION",
        "GP",
        "MIN",
        "PTS",
        "REB",
        "AST",
        "STL",
        "BLK",
        "TOV",
        "FG_PCT",
        "FG3_PCT",
        "FT_PCT",
      ],
      rowSet: [
        [null, "BOS", 591, 34.3, 23.6, 7.3, 3.5, 1.0, 0.7, 2.3, 0.46, 0.37, 0.84],
      ],
    },
  ],
};

describe("Wikidata matching", () => {
  it("prefers an exact basketball player over a same-name athlete in another sport", () => {
    const hit = pickWikidataSearchHit(
      [
        {
          id: "Q1",
          label: "Jayson Tatum",
          description: "American tennis player",
        },
        {
          id: "Q27999334",
          label: "Jayson Tatum",
          description: "American basketball player",
        },
      ],
      "Jayson Tatum"
    );
    expect(hit?.id).toBe("Q27999334");
  });

  it("rejects a non-basketball fuzzy match", () => {
    expect(
      pickWikidataSearchHit(
        [{ id: "Q2", label: "Jay Tatum", description: "American football coach" }],
        "Jayson Tatum"
      )
    ).toBeNull();
  });

  it("picks an exact NFL, MLB, or NHL description for that sport", () => {
    expect(
      pickWikidataSearchHit(
        [
          {
            id: "Q-soccer",
            label: "Patrick Mahomes",
            description: "association football player",
          },
          {
            id: "Q-nfl",
            label: "Patrick Mahomes",
            description: "American football quarterback",
          },
        ],
        "Patrick Mahomes",
        "football"
      )?.id
    ).toBe("Q-nfl");

    expect(
      pickWikidataSearchHit(
        [
          {
            id: "Q-ohtani",
            label: "Shohei Ohtani",
            description: "Japanese baseball player",
          },
        ],
        "Shohei Ohtani",
        "baseball"
      )?.id
    ).toBe("Q-ohtani");

    expect(
      pickWikidataSearchHit(
        [
          {
            id: "Q-mcdavid",
            label: "Connor McDavid",
            description: "Canadian ice hockey player",
          },
        ],
        "Connor McDavid",
        "hockey"
      )?.id
    ).toBe("Q-mcdavid");
  });

  it("rejects a basketball-only hit when the lookup sport is football", () => {
    expect(
      pickWikidataSearchHit(
        [
          {
            id: "Q-bball",
            label: "Patrick Mahomes",
            description: "American basketball player",
          },
        ],
        "Patrick Mahomes",
        "football"
      )
    ).toBeNull();
  });

  it("parses Wikidata SPARQL bio bindings", () => {
    const bio = parseWikidataSparqlBio("Q27999334", "Jayson Tatum", [
      {
        dob: { value: "1998-03-03T00:00:00Z" },
        nbaId: { value: "1628369" },
        teamLabel: { value: "Boston Celtics" },
        collegeLabel: { value: "Duke Blue Devils men's basketball" },
        draftTime: { value: "2017-06-22T00:00:00Z" },
      },
    ]);
    expect(bio.nbaPersonId).toBe("1628369");
    expect(bio.birthYear).toBe(1998);
    expect(bio.team).toBe("Boston Celtics");
    expect(bio.college).toBe("Duke Blue Devils");
    expect(bio.draftYear).toBe(2017);
    expect(bio.imageUrl).toBeNull();
  });

  it("reads a Wikimedia image claim", () => {
    const bio = parseWikidataSparqlBio("Q27999334", "Jayson Tatum", [
      {
        image: {
          value:
            "http://commons.wikimedia.org/wiki/Special:FilePath/Jayson Tatum (Boston Celtics).jpg",
        },
      },
    ]);
    expect(bio.imageUrl).toContain("Special:FilePath");
  });

  it("prefers an NBA club and a university over national team and high school", () => {
    const bio = parseWikidataSparqlBio("Q27999334", "Jayson Tatum", [
      {
        teamLabel: { value: "United States men's national basketball team" },
        collegeLabel: { value: "Chaminade College Preparatory School" },
      },
      {
        teamLabel: { value: "Boston Celtics" },
        collegeLabel: { value: "Duke University" },
      },
    ]);
    expect(bio.team).toBe("Boston Celtics");
    expect(bio.college).toBe("Duke University");
  });
});

describe("NBA stats parsing", () => {
  it("reads common player info into bio fields", () => {
    const bio = parseNbaCommonPlayerInfo(TATUM_INFO);
    expect(bio).toMatchObject({
      nbaPersonId: "1628369",
      team: "Boston Celtics",
      college: "Duke",
      draftYear: 2017,
      draftPick: 3,
      birthYear: 1998,
    });
  });

  it("reads per-game season and career rows", () => {
    const parsed = parseNbaCareerPerGame(TATUM_CAREER);
    expect(parsed.seasons).toHaveLength(2);
    expect(parsed.seasons[1]?.points).toBe(26.8);
    expect(parsed.career?.points).toBe(23.6);
    expect(parsed.career?.isCareer).toBe(true);
  });
});

describe("quality and lifecycle derivation", () => {
  it("scores a high-usage scorer stronger than a low-usage role player", () => {
    const star = deriveQualitySignals(
      [
        {
          season: "2024-25",
          team: "BOS",
          games: 72,
          minutes: 36,
          points: 26.8,
          rebounds: 8.7,
          assists: 6,
          steals: 1.1,
          blocks: 0.5,
          turnovers: 2.9,
          fgPct: 0.45,
          threePct: 0.34,
          ftPct: 0.81,
        },
      ],
      {
        season: "Career",
        team: "BOS",
        games: 591,
        minutes: 34.3,
        points: 23.6,
        rebounds: 7.3,
        assists: 3.5,
        steals: 1,
        blocks: 0.7,
        turnovers: 2.3,
        fgPct: 0.46,
        threePct: 0.37,
        ftPct: 0.84,
        isCareer: true,
      }
    );
    const role = deriveQualitySignals(
      [
        {
          season: "2024-25",
          team: "BOS",
          games: 68,
          minutes: 14,
          points: 6.2,
          rebounds: 2.1,
          assists: 1.0,
          steals: 0.3,
          blocks: 0.2,
          turnovers: 0.6,
          fgPct: 0.44,
          threePct: 0.33,
          ftPct: 0.75,
        },
      ],
      {
        season: "Career",
        team: "BOS",
        games: 200,
        minutes: 14,
        points: 6.2,
        rebounds: 2.1,
        assists: 1.0,
        steals: 0.3,
        blocks: 0.2,
        turnovers: 0.6,
        fgPct: 0.44,
        threePct: 0.33,
        ftPct: 0.75,
        isCareer: true,
      }
    );

    expect(star.availableFieldCount).toBeGreaterThan(0);
    expect(star.careerStrength ?? 0).toBeGreaterThan(role.careerStrength ?? 0);
    expect(star.injuryRisk).toBeLessThan(40);
  });

  it("raises injury risk after a sharp games-played drop", () => {
    const quality = deriveQualitySignals(
      [
        {
          season: "2023-24",
          team: "BOS",
          games: 74,
          minutes: 35,
          points: 26,
          rebounds: 8,
          assists: 5,
          steals: 1,
          blocks: 0.6,
          turnovers: 2.5,
          fgPct: 0.47,
          threePct: 0.37,
          ftPct: 0.83,
        },
        {
          season: "2024-25",
          team: "BOS",
          games: 28,
          minutes: 30,
          points: 24,
          rebounds: 7,
          assists: 4,
          steals: 1,
          blocks: 0.5,
          turnovers: 2.2,
          fgPct: 0.45,
          threePct: 0.35,
          ftPct: 0.82,
        },
      ],
      null
    );
    expect(quality.injuryRisk).toBeGreaterThan(60);
  });

  it("marks a player retired when the last season is stale", () => {
    expect(
      lifecycleFromPublicCareer({
        birthYear: 1984,
        lastSeasonStartYear: 2018,
        seasonCount: 15,
        asOf: new Date("2026-09-05T00:00:00Z"),
      })
    ).toBe("retired");
  });

  it("keeps a current rotation player active", () => {
    expect(
      lifecycleFromPublicCareer({
        birthYear: 1998,
        lastSeasonStartYear: 2025,
        seasonCount: 8,
        asOf: new Date("2026-09-05T00:00:00Z"),
      })
    ).toBe("active");
  });

  it("derives thinner quality from public bio when counting stats are missing", () => {
    const quality = deriveQualitySignals([], null, {
      sport: "football",
      asOf: new Date("2026-09-05T00:00:00Z"),
      bio: {
        team: "Kansas City Chiefs",
        birthDate: "1995-09-17",
        birthYear: 1995,
        age: 30,
        college: "Texas Tech",
        draftYear: 2017,
        draftRound: 1,
        draftPick: 10,
        undrafted: false,
        position: "QB",
        nbaPersonId: null,
        wikidataId: "Q27853557",
      },
    });
    expect(quality.careerStrength).toBeNull();
    expect(quality.availableFieldCount).toBeGreaterThan(0);
    expect(quality.culturalRelevance).toBeGreaterThan(40);
  });

  it("does not invent a career status without bio or seasons", () => {
    const profile = derivePlayerProfile(
      {
        team: null,
        birthDate: null,
        birthYear: null,
        age: null,
        college: null,
        draftYear: null,
        draftRound: null,
        draftPick: null,
        undrafted: false,
        position: null,
        nbaPersonId: null,
        wikidataId: null,
      },
      []
    );
    expect(profile.careerStatus).toBeNull();
    expect(
      liveStatsCanScore({
        qualitySignals: {
          availableFieldCount: 0,
          careerStrength: null,
          legacyStrength: null,
          culturalRelevance: null,
          injuryRisk: null,
        },
        playerProfile: profile,
        seasons: [],
      })
    ).toBe(false);
  });

  it("formats a draft line", () => {
    expect(
      formatDraftLine({
        team: "Boston Celtics",
        birthDate: "1998-03-03",
        birthYear: 1998,
        age: 28,
        college: "Duke",
        draftYear: 2017,
        draftRound: 1,
        draftPick: 3,
        undrafted: false,
        position: "Forward",
        nbaPersonId: "1628369",
        wikidataId: "Q27999334",
      })
    ).toBe("2017 · No. 3");
  });
});

describe("player stats provider", () => {
  it("supports the four majors and skips soccer", () => {
    expect(isBasketballSport("Basketball")).toBe(true);
    expect(isBasketballSport("Football")).toBe(false);
    expect(isSupportedPlayerStatsSport("Football")).toBe(true);
    expect(isSupportedPlayerStatsSport("Baseball")).toBe(true);
    expect(isSupportedPlayerStatsSport("Hockey")).toBe(true);
    expect(isSupportedPlayerStatsSport("Soccer")).toBe(false);
  });

  it("returns null for unsupported sports without fetching", async () => {
    const snapshot = await loadPlayerLiveStats(
      { playerName: "Lionel Messi", sportLabel: "Soccer" },
      {
        fetchJson: async () => {
          throw new Error("should not fetch");
        },
      }
    );
    expect(snapshot).toBeNull();
  });

  it("merges Wikidata bio with NBA stats and can score without a catalog card", async () => {
    clearPlayerLiveStatsCache();
    clearWikidataCaches();
    clearNbaCaches();

    const snapshot = await loadPlayerLiveStats(
      {
        playerName: "Jayson Tatum",
        sportLabel: "Basketball",
        asOf: "2026-09-05T00:00:00Z",
      },
      {
        probeImage: async () => true,
        fetchJson: async (url) => {
          if (url.includes("wbsearchentities")) {
            return {
              search: [
                {
                  id: "Q27999334",
                  label: "Jayson Tatum",
                  description: "American basketball player",
                },
              ],
            };
          }
          if (url.includes("sparql")) {
            return {
              results: {
                bindings: [
                  {
                    dob: { value: "1998-03-03T00:00:00Z" },
                    nbaId: { value: "1628369" },
                    teamLabel: { value: "Boston Celtics" },
                    collegeLabel: { value: "Duke University" },
                    draftTime: { value: "2017-06-22T00:00:00Z" },
                  },
                ],
              },
            };
          }
          throw new Error(`unexpected wiki url ${url}`);
        },
        fetchNbaJson: async (url) => {
          if (url.includes("commonplayerinfo")) return TATUM_INFO;
          if (url.includes("playercareerstats")) return TATUM_CAREER;
          throw new Error(`unexpected nba url ${url}`);
        },
      }
    );

    expect(snapshot?.bio.team).toBe("Boston Celtics");
    expect(snapshot?.bio.college).toBe("Duke");
    expect(snapshot?.bio.draftPick).toBe(3);
    expect(snapshot?.imageUrl).toBe(nbaHeadshotUrl("1628369"));
    expect(snapshot?.seasons).toHaveLength(2);
    expect(snapshot?.qualitySignals.availableFieldCount).toBeGreaterThan(0);
    expect(liveStatsCanScore(snapshot!)).toBe(true);

    const opportunity = computePlayerOpportunity(
      buildPlayerOpportunityContextFromIdentity({
        playerName: "Jayson Tatum",
        sport: "Basketball",
        playerProfile: snapshot!.playerProfile,
        qualitySignals: snapshot!.qualitySignals,
      })
    );
    expect(opportunity.opportunityScore).toBeGreaterThan(50);
    expect(opportunity.qualityScore).toBeGreaterThan(50);
  });

  it("keeps Wikidata bio when NBA Stats is blocked", async () => {
    clearPlayerLiveStatsCache();
    clearWikidataCaches();
    clearNbaCaches();

    const snapshot = await loadPlayerLiveStats(
      { playerName: "Jayson Tatum", sportLabel: "Basketball" },
      {
        probeImage: async (url) => url.includes("wikimedia"),
        fetchJson: async (url) => {
          if (url.includes("wbsearchentities")) {
            return {
              search: [
                {
                  id: "Q27999334",
                  label: "Jayson Tatum",
                  description: "American basketball player",
                },
              ],
            };
          }
          if (url.includes("sparql")) {
            return {
              results: {
                bindings: [
                  {
                    dob: { value: "1998-03-03T00:00:00Z" },
                    nbaId: { value: "1628369" },
                    teamLabel: { value: "Boston Celtics" },
                    collegeLabel: { value: "Duke University" },
                    image: {
                      value:
                        "http://commons.wikimedia.org/wiki/Special:FilePath/Jayson%20Tatum.jpg",
                    },
                  },
                ],
              },
            };
          }
          throw new Error("blocked");
        },
        fetchNbaJson: async () => {
          throw new Error("NBA blocked");
        },
      }
    );

    expect(snapshot?.bio.team).toBe("Boston Celtics");
    expect(snapshot?.bio.birthYear).toBe(1998);
    expect(snapshot?.seasons).toEqual([]);
    expect(snapshot?.imageUrl).toContain("commons.wikimedia.org");
    expect(snapshot?.sourceNotes.some((note) => /NBA Stats/.test(note))).toBe(true);
  });
});

describe("player image resolution", () => {
  it("builds NBA and Wikimedia image URLs", () => {
    expect(nbaHeadshotUrl("1628369")).toBe(
      "https://cdn.nba.com/headshots/nba/latest/1040x760/1628369.png"
    );
    expect(
      wikimediaFileUrl(
        "http://commons.wikimedia.org/wiki/Special:FilePath/Jayson Tatum.jpg"
      )
    ).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Jayson%20Tatum.jpg?width=640"
    );
  });

  it("prefers a reachable NBA headshot over Wikimedia", async () => {
    const resolved = await resolvePlayerImageUrl({
      nbaPersonId: "1628369",
      wikidataImage:
        "http://commons.wikimedia.org/wiki/Special:FilePath/Jayson Tatum.jpg",
      probeImage: async (url) => url.includes("cdn.nba.com"),
    });
    expect(resolved).toEqual({
      url: nbaHeadshotUrl("1628369"),
      source: "NBA headshot",
    });
  });

  it("falls back to Wikipedia when other image probes fail", async () => {
    const resolved = await resolvePlayerImageUrl({
      playerName: "Jayson Tatum",
      probeImage: async (url) => url.includes("upload.wikimedia.org"),
      fetchJson: async () => ({
        thumbnail: {
          source:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/tatum.jpg/200px-tatum.jpg",
        },
      }),
    });
    expect(resolved?.source).toBe("Wikipedia");
    expect(resolved?.url).toContain("upload.wikimedia.org");
  });
});
