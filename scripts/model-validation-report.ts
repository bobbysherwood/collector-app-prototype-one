import {
  bucketReturns,
  recommendationConfusion,
  runPointInTimeBacktest,
} from "../src/lib/model-validation/engine/backtest";
import { MODEL_DESIGN_NOTES } from "../src/lib/model-validation/model-notes";
import { formatValidationReport } from "../src/lib/model-validation/report";
import { runValidationSuite } from "../src/lib/model-validation/run-suite";

const report = runValidationSuite();
const { observations, summary } = runPointInTimeBacktest();
const holdout = observations.filter((row) => row.split === "holdout");
const buckets = bucketReturns(holdout.length ? holdout : observations);
const confusion = recommendationConfusion(holdout.length ? holdout : observations);

console.log(formatValidationReport({ ...report, backtest: summary }));
console.log("Return by Opportunity Score bucket (holdout-preferred)");
console.log("-----------------------------------------------------");
for (const bucket of buckets) {
  console.log(
    `${bucket.bucket.padEnd(8)} n=${String(bucket.count).padStart(3)}  avg=${
      bucket.average == null ? "n/a" : `${(bucket.average * 100).toFixed(1)}%`
    }  median=${bucket.median == null ? "n/a" : `${(bucket.median * 100).toFixed(1)}%`}`
  );
}
console.log("");
console.log("Recommendation validation");
console.log("-------------------------");
console.log(`Buy precision:  ${fmt(confusion.buyPrecision)}`);
console.log(`Buy recall:     ${fmt(confusion.buyRecall)}`);
console.log(`Sell precision: ${fmt(confusion.sellPrecision)}`);
console.log(`Sell recall:    ${fmt(confusion.sellRecall)}`);
console.log(`Directional:    ${fmt(confusion.directionalAccuracy)}`);
console.log("");
console.log("Documented model-design notes");
console.log("-----------------------------");
for (const note of MODEL_DESIGN_NOTES) {
  console.log(`- ${note}`);
}

function fmt(value: number | null): string {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}
