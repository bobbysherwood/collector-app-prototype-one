import { describe, expect, it } from "vitest";
import { liveStatsCanScore } from "@/lib/player-stats/derive";
import {
  parseMlbPeopleSearch,
  parseMlbPersonBio,
  parseMlbPlayerStats,
  pickMlbPerson,
} from "@/lib/player-stats/mlb-stats";
import {
  parseEspnAthleteBio,
  parseEspnNflStats,
  parseEspnSearchHits,
  pickEspnAthlete,
} from "@/lib/player-stats/nfl-espn";
import {
  parseNhlLanding,
  parseNhlSearchHits,
  pickNhlPlayer,
} from "@/lib/player-stats/nhl-stats";
import {
  buildEmptyProfilePatch,
  isExactPlayerNameMatch,
} from "@/lib/player-stats/persist-profile";
import {
  clearPlayerLiveStatsCache,
  loadPlayerLiveStats,
} from "@/lib/player-stats/provider";
import { clearWikidataCaches } from "@/lib/player-stats/wikidata";

const MAHOMES_WIKI = {
  search: [
    {
      id: "Q27853557",
      label: "Patrick Mahomes",
      description: "American football quarterback",
    },
  ],
};

const MAHOMES_SPARQL = {
  results: {
    bindings: [
      {
        dob: { value: "1995-09-17T00:00:00Z" },
        teamLabel: { value: "Kansas City Chiefs" },
        collegeLabel: { value: "Texas Tech University" },
        draftTime: { value: "2017-04-27T00:00:00Z" },
      },
    ],
  },
};

describe("league stat parsers", () => {
  it("parses an MLB people search and hitting line", () => {
    const people = parseMlbPeopleSearch({
      people: [
        { id: 660271, fullName: "Shohei Ohtani" },
        { id: 1, fullName: "Someone Else" },
      ],
    });
    expect(pickMlbPerson(people, "Shohei Ohtani")?.id).toBe("660271");
    expect(pickMlbPerson(people, "Shohei Otani")).toBeNull();

    const bio = parseMlbPersonBio(
      {
        people: [
          {
            id: 660271,
            fullName: "Shohei Ohtani",
            birthDate: "1994-07-05",
            currentTeam: { name: "Los Angeles Dodgers" },
            primaryPosition: { abbreviation: "DH" },
          },
        ],
      },
      "660271"
    );
    expect(bio?.birthYear).toBe(1994);
    expect(bio?.team).toBe("Los Angeles Dodgers");

    const stats = parseMlbPlayerStats({
      stats: [
        {
          type: { displayName: "Year by Year" },
          group: { displayName: "hitting" },
          splits: [
            {
              season: "2024",
              team: { name: "Los Angeles Dodgers" },
              stat: {
                gamesPlayed: 159,
                avg: 0.31,
                homeRuns: 54,
                rbi: 130,
                ops: 1.036,
              },
            },
          ],
        },
        {
          type: { displayName: "Career" },
          group: { displayName: "hitting" },
          splits: [
            {
              season: "Career",
              stat: { gamesPlayed: 800, avg: 0.282, homeRuns: 200, rbi: 500, ops: 0.96 },
            },
          ],
        },
      ],
    });
    expect(stats.seasons[0]?.production).toBeGreaterThan(70);
    expect(stats.career?.rebounds).toBe(200);
  });

  it("parses NHL search and landing career totals", () => {
    const hits = parseNhlSearchHits([
      { playerId: 8478402, name: "Connor McDavid" },
      { playerId: 1, name: "Other Player" },
    ]);
    expect(pickNhlPlayer(hits, "Connor McDavid")?.id).toBe("8478402");

    const landing = parseNhlLanding(
      {
        firstName: { default: "Connor" },
        lastName: { default: "McDavid" },
        birthDate: "1997-01-13",
        currentTeamAbbrev: "EDM",
        fullTeamName: { default: "Edmonton Oilers" },
        position: "C",
        featuredStats: {
          regularSeason: {
            career: { gamesPlayed: 700, goals: 350, assists: 700, points: 1050 },
            subSeason: { gamesPlayed: 74, goals: 32, assists: 74, points: 106 },
          },
        },
        seasonTotals: [
          {
            season: 20232024,
            gameTypeId: 2,
            teamName: { default: "Edmonton Oilers" },
            gamesPlayed: 76,
            goals: 32,
            assists: 100,
            points: 132,
          },
        ],
      },
      "8478402"
    );
    expect(landing?.bio.team).toBe("Edmonton Oilers");
    expect(landing?.bio.birthYear).toBe(1997);
    expect(landing?.seasons[0]?.points).toBe(132);
    expect(landing?.career?.production).toBeGreaterThan(50);
  });

  it("parses ESPN NFL search and a passing season", () => {
    const hits = parseEspnSearchHits({
      items: [
        {
          id: "3139477",
          displayName: "Patrick Mahomes",
          sport: "football",
          league: "nfl",
        },
        {
          id: "9",
          displayName: "Patrick Mahomes",
          sport: "soccer",
        },
      ],
    });
    expect(pickEspnAthlete(hits, "Patrick Mahomes")?.id).toBe("3139477");

    const bio = parseEspnAthleteBio(
      {
        athlete: {
          displayName: "Patrick Mahomes",
          dateOfBirth: "1995-09-17T07:00Z",
          team: { displayName: "Kansas City Chiefs" },
          college: { name: "Texas Tech" },
          position: { abbreviation: "QB" },
          draft: { year: 2017 },
        },
      },
      "3139477"
    );
    expect(bio?.birthYear).toBe(1995);
    expect(bio?.team).toBe("Kansas City Chiefs");

    const stats = parseEspnNflStats({
      season: { year: 2024, displayName: "2024" },
      categories: [
        {
          names: ["gamesPlayed", "passingYards", "passingTouchdowns"],
          totals: [16, 3928, 26],
        },
      ],
    });
    expect(stats.seasons[0]?.production).toBeGreaterThan(50);
    expect(stats.seasons[0]?.games).toBe(16);
  });
});

describe("catalog profile persist rules", () => {
  it("writes only empty birth year, team, and career status", () => {
    expect(
      buildEmptyProfilePatch(
        { birthYear: null, team: null, careerStatus: null },
        { birthYear: 1995, team: "Kansas City Chiefs", careerStatus: "active" }
      )
    ).toEqual({
      birthYear: 1995,
      team: "Kansas City Chiefs",
      careerStatus: "active",
    });

    expect(
      buildEmptyProfilePatch(
        { birthYear: 1995, team: "Chiefs", careerStatus: "active" },
        { birthYear: 1994, team: "Kansas City Chiefs", careerStatus: "retired" }
      )
    ).toBeNull();
  });

  it("requires an exact resolved name for persist eligibility helpers", () => {
    expect(isExactPlayerNameMatch("Patrick Mahomes", "Patrick Mahomes")).toBe(true);
    expect(isExactPlayerNameMatch("Patrick Mahomes", "Pat Mahomes")).toBe(false);
  });
});

describe("multi-sport live stats", () => {
  it("loads Wikidata bio for football when ESPN is blocked", async () => {
    clearPlayerLiveStatsCache();
    clearWikidataCaches();

    const snapshot = await loadPlayerLiveStats(
      {
        playerName: "Patrick Mahomes",
        sportLabel: "Football",
        asOf: "2026-09-05T00:00:00Z",
      },
      {
        probeImage: async () => false,
        fetchJson: async (url) => {
          if (url.includes("wbsearchentities")) return MAHOMES_WIKI;
          if (url.includes("sparql")) return MAHOMES_SPARQL;
          throw new Error("blocked");
        },
        fetchEspnJson: async () => {
          throw new Error("ESPN blocked");
        },
      }
    );

    expect(snapshot?.bio.team).toBe("Kansas City Chiefs");
    expect(snapshot?.bio.birthYear).toBe(1995);
    expect(snapshot?.seasons).toEqual([]);
    expect(snapshot?.playerProfile.careerStatus).toBe("active");
    expect(snapshot?.qualitySignals.availableFieldCount).toBeGreaterThan(0);
    expect(snapshot?.persistEligible).toBe(true);
    expect(liveStatsCanScore(snapshot!)).toBe(true);
  });

  it("merges MLB season lines onto a Wikidata bio", async () => {
    clearPlayerLiveStatsCache();
    clearWikidataCaches();

    const snapshot = await loadPlayerLiveStats(
      { playerName: "Shohei Ohtani", sportLabel: "Baseball" },
      {
        probeImage: async () => false,
        fetchJson: async (url) => {
          if (url.includes("wbsearchentities")) {
            return {
              search: [
                {
                  id: "Q19970784",
                  label: "Shohei Ohtani",
                  description: "Japanese baseball player",
                },
              ],
            };
          }
          if (url.includes("sparql")) {
            return {
              results: {
                bindings: [
                  {
                    dob: { value: "1994-07-05T00:00:00Z" },
                    teamLabel: { value: "Los Angeles Dodgers" },
                  },
                ],
              },
            };
          }
          throw new Error(`unexpected wiki url ${url}`);
        },
        fetchMlbJson: async (url) => {
          if (url.includes("people/search")) {
            return { people: [{ id: 660271, fullName: "Shohei Ohtani" }] };
          }
          if (url.includes("/people/660271?") || /\/people\/660271$/.test(url)) {
            return {
              people: [
                {
                  id: 660271,
                  fullName: "Shohei Ohtani",
                  birthDate: "1994-07-05",
                  currentTeam: { name: "Los Angeles Dodgers" },
                  primaryPosition: { abbreviation: "DH" },
                },
              ],
            };
          }
          if (url.includes("/stats")) {
            return {
              stats: [
                {
                  type: { displayName: "Year by Year" },
                  group: { displayName: "hitting" },
                  splits: [
                    {
                      season: "2024",
                      team: { name: "Los Angeles Dodgers" },
                      stat: {
                        gamesPlayed: 159,
                        avg: 0.31,
                        homeRuns: 54,
                        rbi: 130,
                        ops: 1.036,
                      },
                    },
                  ],
                },
              ],
            };
          }
          throw new Error(`unexpected mlb url ${url}`);
        },
      }
    );

    expect(snapshot?.bio.mlbPersonId).toBe("660271");
    expect(snapshot?.seasons).toHaveLength(1);
    expect(snapshot?.qualitySignals.careerStrength).toBeGreaterThan(70);
    expect(snapshot?.persistEligible).toBe(true);
  });

  it("does not mark a fuzzy Wikidata hit persist-eligible", async () => {
    clearPlayerLiveStatsCache();
    clearWikidataCaches();

    const snapshot = await loadPlayerLiveStats(
      { playerName: "Patrick Mahomes", sportLabel: "Football" },
      {
        wikiOnly: true,
        probeImage: async () => false,
        fetchJson: async (url) => {
          if (url.includes("wbsearchentities")) {
            return {
              search: [
                {
                  id: "Q-fuzzy",
                  label: "Patrick Mahomes Jr.",
                  description: "American football quarterback",
                },
              ],
            };
          }
          if (url.includes("sparql")) {
            return {
              results: {
                bindings: [{ dob: { value: "1995-09-17T00:00:00Z" } }],
              },
            };
          }
          throw new Error(`unexpected url ${url}`);
        },
      }
    );

    expect(snapshot?.persistEligible).toBe(false);
  });
});
