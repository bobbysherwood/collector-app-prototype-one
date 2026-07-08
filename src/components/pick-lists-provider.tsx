"use client";

import { createContext, useContext } from "react";
import { DEFAULT_ACTIVE_PICK_LISTS } from "@/lib/pick-list-defaults";
import type { ActivePickLists } from "@/types/pick-list";

const PickListsContext = createContext<ActivePickLists>(DEFAULT_ACTIVE_PICK_LISTS);

export function PickListsProvider({
  pickLists,
  children,
}: {
  pickLists: ActivePickLists;
  children: React.ReactNode;
}) {
  return (
    <PickListsContext.Provider value={pickLists}>
      {children}
    </PickListsContext.Provider>
  );
}

export function usePickLists(): ActivePickLists {
  return useContext(PickListsContext);
}
