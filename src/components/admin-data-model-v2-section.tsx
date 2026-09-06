import { AdminDataModelV2Panel } from "@/components/admin-data-model-v2-panel";
import {
  getDm2Attributes,
  getDm2Brands,
  getDm2CardSets,
  getDm2CardSetCategories,
  getDm2CardSetNames,
  getDm2Manufacturers,
  getDm2Parallels,
  getDm2Players,
} from "@/lib/data-model-v2-data";
import { getAdminPickLists } from "@/lib/pick-list-data";

export async function AdminDataModelV2Section() {
  const [
    pickLists,
    cardSetCategories,
    cardSetNames,
    manufacturers,
    brands,
    parallels,
    players,
    attributes,
    cardSets,
  ] = await Promise.all([
    getAdminPickLists(),
    getDm2CardSetCategories(),
    getDm2CardSetNames(),
    getDm2Manufacturers(),
    getDm2Brands(),
    getDm2Parallels(),
    getDm2Players(),
    getDm2Attributes(),
    getDm2CardSets(),
  ]);

  return (
    <AdminDataModelV2Panel
      sports={pickLists.sport}
      cardSetCategories={cardSetCategories}
      cardSetNames={cardSetNames}
      manufacturers={manufacturers}
      brands={brands}
      parallels={parallels}
      players={players}
      attributes={attributes}
      cardSets={cardSets}
    />
  );
}
