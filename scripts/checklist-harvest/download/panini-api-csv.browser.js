async function paniniApiCsvEval(args) {
  const PANINI_CHECKLIST_CSV_HEADER =
    "Sport,Year,Brand,Program,CARD SET,CARD #,ATHLETE,TEAM,POSITION";

  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const formatPaniniChecklistRow = (metadata, card) =>
    [
      metadata.sport,
      metadata.year,
      metadata.brand,
      metadata.program,
      card.cardSet,
      card.cardNo,
      card.athlete,
      card.team,
      card.position,
    ]
      .map(csvCell)
      .join(",");

  const { api, sportId, sport, year, brand, setLabel, programIdHint } = args;

  const post = async (body) => {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        activity: sportId,
        year,
        brand,
        program: "",
        card_set: "",
        card: "",
        replace_wo_inventory: "1",
        from_frontend: "0",
        ...body,
      }),
    });
    const json = await res.json();
    if (json.status !== 200 || !Array.isArray(json.data)) {
      throw new Error("Panini API error: " + JSON.stringify(json).slice(0, 200));
    }
    return json.data;
  };

  let programId = programIdHint ? String(programIdHint) : "";
  if (!programId) {
    const programs = await post({ program: "", from_frontend: "2" });
    const match = programs.find((p) => p.name === setLabel);
    if (!match) throw new Error("Program not found: " + setLabel);
    programId = String(match.id);
  }

  const sets = await post({ program: programId });
  const rows = [PANINI_CHECKLIST_CSV_HEADER];
  const metadata = {
    sport,
    year,
    brand,
    program: setLabel,
  };

  for (const set of sets) {
    const cards = await post({ program: programId, card_set: String(set.id) });
    for (const card of cards) {
      rows.push(
        formatPaniniChecklistRow(metadata, {
          cardSet: set.name,
          cardNo: card.no,
          athlete: card.player,
          team: card.team,
          position: card.pos,
        })
      );
    }
  }

  if (rows.length <= 1) throw new Error("No checklist rows returned from Panini API");
  return rows.join("\r\n");
}

async function resolveProgramIdEval(args) {
  const { year, brand, setLabel } = args;
  const res = await fetch("https://support.paniniamerica.net/replacement-card-selection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      activity: "9",
      year,
      brand,
      program: "",
      card_set: "",
      card: "",
      replace_wo_inventory: "1",
      from_frontend: "2",
    }),
  });
  const json = await res.json();
  const match = json.data?.find((p) => p.name === setLabel);
  return match?.id;
}

module.exports = { paniniApiCsvEval, resolveProgramIdEval };
