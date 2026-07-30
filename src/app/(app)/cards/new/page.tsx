import { AddCardWizard } from "@/components/add-card-wizard";
import { getDm2CardFormLookups } from "@/lib/data-model-v2-data";

export default async function NewCardPage() {
  const dm2Lookups = await getDm2CardFormLookups();

  return <AddCardWizard dm2Lookups={dm2Lookups} />;
}
