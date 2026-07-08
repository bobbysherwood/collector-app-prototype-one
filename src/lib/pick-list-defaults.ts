import {
  CARD_TYPES,
  GRADERS,
  GRADES,
  SPORTS,
} from "@/lib/constants";
import { sortPickListLabels, sortGradeLabels } from "@/lib/pick-list-utils";
import type { ActivePickLists } from "@/types/pick-list";

export const DEFAULT_ACTIVE_PICK_LISTS: ActivePickLists = {
  cardTypes: sortPickListLabels([...CARD_TYPES]),
  sports: sortPickListLabels([...SPORTS]),
  graders: sortPickListLabels([...GRADERS]),
  grades: sortGradeLabels([...GRADES]),
};
