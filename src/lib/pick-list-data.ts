import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ACTIVE_PICK_LISTS } from "@/lib/pick-list-defaults";
import {
  sortGradeLabels,
  sortGradePickListOptions,
  sortPickListLabels,
  sortPickListOptions,
} from "@/lib/pick-list-utils";
import type {
  ActivePickLists,
  AdminPickLists,
  PickListCategory,
  PickListOption,
} from "@/types/pick-list";
import { PICK_LIST_CATEGORIES } from "@/types/pick-list";

function mapRow(row: {
  id: string;
  category: PickListCategory;
  label: string;
  active: boolean;
  sort_order: number;
}): PickListOption {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

function emptyAdminPickLists(): AdminPickLists {
  return {
    card_type: [],
    sport: [],
    grader: [],
    grade: [],
  };
}

function groupActiveOptions(rows: PickListOption[]): ActivePickLists {
  const grouped = emptyAdminPickLists();
  for (const row of rows) {
    grouped[row.category].push(row);
  }

  return {
    cardTypes: sortPickListLabels(grouped.card_type.map((row) => row.label)),
    sports: sortPickListLabels(grouped.sport.map((row) => row.label)),
    graders: sortPickListLabels(grouped.grader.map((row) => row.label)),
    grades: sortGradeLabels(grouped.grade.map((row) => row.label)),
  };
}

function groupAdminOptions(rows: PickListOption[]): AdminPickLists {
  const grouped = emptyAdminPickLists();
  for (const row of rows) {
    grouped[row.category].push(row);
  }
  for (const category of PICK_LIST_CATEGORIES) {
    grouped[category] =
      category === "grade"
        ? sortGradePickListOptions(grouped[category])
        : sortPickListOptions(grouped[category]);
  }
  return grouped;
}

async function fetchPickListRows(activeOnly: boolean): Promise<PickListOption[]> {
  const supabase = await createClient();
  let query = supabase
    .from("pick_list_options")
    .select("id, category, label, active, sort_order")
    .order("label", { ascending: true });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load pick list options:", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function getActivePickLists(): Promise<ActivePickLists> {
  const rows = await fetchPickListRows(true);
  if (rows.length === 0) {
    return DEFAULT_ACTIVE_PICK_LISTS;
  }
  return groupActiveOptions(rows);
}

export async function getAdminPickLists(): Promise<AdminPickLists> {
  const rows = await fetchPickListRows(false);
  if (rows.length === 0) {
    return PICK_LIST_CATEGORIES.reduce((acc, category) => {
      const labels =
        category === "card_type"
          ? DEFAULT_ACTIVE_PICK_LISTS.cardTypes
          : category === "sport"
            ? DEFAULT_ACTIVE_PICK_LISTS.sports
            : category === "grader"
              ? DEFAULT_ACTIVE_PICK_LISTS.graders
              : DEFAULT_ACTIVE_PICK_LISTS.grades;

      acc[category] =
        category === "grade"
          ? sortGradePickListOptions(
              labels.map((label, index) => ({
                id: `default-${category}-${index}`,
                category,
                label,
                active: true,
                sortOrder: index + 1,
              }))
            )
          : sortPickListOptions(
              labels.map((label, index) => ({
                id: `default-${category}-${index}`,
                category,
                label,
                active: true,
                sortOrder: index + 1,
              }))
            );
      return acc;
    }, emptyAdminPickLists());
  }
  return groupAdminOptions(rows);
}
