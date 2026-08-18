import { readFileSync } from "fs";
import { join } from "path";

const html = readFileSync(join(__dirname, "probe-output/root-html.html"), "utf8");
console.log("length", html.length);
console.log("has close-dropdown", html.includes("close-dropdown"));

for (const id of ["activity_type", "year_type", "brand_type", "program_type"]) {
  const re = new RegExp(`id="close-dropdown-${id}"[^>]*>[^<]*`, "g");
  const m = html.match(re);
  console.log(id, m?.[0]?.slice(0, 200));
}

const dropdownItems = html.match(/dropdown-item[^>]*>[^<]{1,80}/g);
console.log("\ndropdown-item samples:", dropdownItems?.slice(0, 15));
