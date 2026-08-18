#!/usr/bin/env node
import { Command } from "commander";
import { registerApproveArgs } from "./commands/approve";
import { registerCompileArgs } from "./commands/compile";
import { registerDiscoverArgs } from "./commands/discover";
import { registerDownloadArgs } from "./commands/download";
import { registerRepairCatalogArgs } from "./commands/repair-catalog";
import { registerRunArgs } from "./commands/run";
import { registerStatusArgs } from "./commands/status";

const program = new Command();

program
  .name("checklist-harvest")
  .description("Panini Basketball checklist harvest agent (V1)")
  .option("--storage <kind>", "Storage backend: local | supabase", "local")
  .option("--root <path>", "Local storage root", "./data/checklist-harvest")
  .option("--verbose", "Debug logging", false)
  .option("--json-logs", "JSON log output", false);

registerDiscoverArgs(program.command("discover").description("Enumerate checklist targets"));
registerRunArgs(program.command("run").description("Full pipeline: discover → download → compile"));
registerDownloadArgs(program.command("download").description("Download raw CSVs only"));
registerRepairCatalogArgs(
  program.command("repair-catalog").description("Fix misassigned brand duplicates in catalog")
);
registerCompileArgs(program.command("compile").description("Compile from existing raw files"));
registerStatusArgs(program.command("status").description("Show run summary"));
registerApproveArgs(program.command("approve").description("Promote compiled files to approved/"));

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(2);
});
