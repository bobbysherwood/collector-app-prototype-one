/** Explore Panini checklist API for CSV export. */
const API = "https://support.paniniamerica.net/replacement-card-selection";

async function post(body: Record<string, string>) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "CollectorApp-ChecklistHarvest/1.0 (+internal research)",
    },
    body: JSON.stringify({
      replace_wo_inventory: "1",
      from_frontend: "0",
      card_set: "",
      card: "",
      ...body,
    }),
  });
  const text = await res.text();
  return { status: res.status, ct: res.headers.get("content-type"), text };
}

async function main() {
  const steps = [
    { activity: "9" },
    { activity: "9", year: "2022" },
    { activity: "9", year: "2022", brand: "Donruss" },
    { activity: "9", year: "2022", brand: "Donruss", program: "1155" },
    { activity: "9", year: "2022", brand: "Donruss", program: "1155", card_set: "125097" },
    { activity: "9", year: "2022", brand: "Donruss", program: "1155", from_frontend: "2" },
    { activity: "9", year: "2022", brand: "Donruss", program: "1155", from_frontend: "3" },
    { activity: "9", year: "2022", brand: "Donruss", program: "1155", from_frontend: "download" },
  ];

  for (const body of steps) {
    const r = await post(body);
    console.log("\n===", JSON.stringify(body), "===");
    console.log(r.status, r.ct, r.text.slice(0, 500));
  }
}

main().catch(console.error);
