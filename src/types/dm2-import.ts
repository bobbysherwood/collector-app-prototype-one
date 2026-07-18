export type Dm2ImportEntityType =
  | "sport"
  | "manufacturer"
  | "brand"
  | "cardSetCategory"
  | "cardSetName"
  | "parallel";

export type Dm2ImportIssueType =
  | "MISSING_REQUIRED"
  | "UNRESOLVED_LOOKUP"
  | "LOW_CONFIDENCE"
  | "DUPLICATE_EXACT"
  | "DUPLICATE_NEAR"
  | "CROSS_FILE_CONFLICT"
  | "UNSUPPORTED_FIELD"
  | "AMBIGUOUS_MATCH"
  | "MAPPING_SUGGESTION";

export type Dm2SuggestionSource = "catalog" | "web" | "framework";

export type Dm2SuggestionField =
  | "sport"
  | "year"
  | "manufacturer"
  | "brand"
  | "cardSetCategory"
  | "cardSetName"
  | "cardNumber"
  | "player"
  | "parallel";

export interface Dm2FieldSuggestion {
  id: string;
  field: Dm2SuggestionField;
  rowId?: string;
  currentValue?: string | number;
  suggestedValue: string | number;
  reason: string;
  source: Dm2SuggestionSource;
  confidence: number;
  applied: boolean;
}

export interface Dm2ImportResearchNote {
  id: string;
  source: "catalog" | "web";
  title: string;
  detail: string;
  url?: string;
}

export interface Dm2MappingFrameworkNote {
  pattern: string;
  explanation: string;
}

export type Dm2ImportIssueSeverity = "blocking" | "warning";

export type Dm2LookupProposalAction = "use_existing" | "create_new" | "pending";

export interface Dm2ImportFileInput {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface Dm2ExtractedRow {
  id: string;
  sourceFileName: string;
  sourceRowIndex: number;
  sport?: string;
  year?: number;
  manufacturer?: string;
  brand?: string;
  cardSetCategory?: string;
  cardSetName?: string;
  cardNumber?: string;
  player?: string;
  parallel?: string;
  confidence: number;
  unsupportedFields?: Record<string, string>;
  excluded: boolean;
  suggestions?: Dm2FieldSuggestion[];
}

export interface Dm2LookupProposal {
  id: string;
  entityType: Dm2ImportEntityType;
  proposedName: string;
  normalizedKey: string;
  matchId?: string;
  matchName?: string;
  matchCandidates?: Array<{ id: string; name: string; score: number }>;
  confidence: number;
  action: Dm2LookupProposalAction;
  referenceCount: number;
  manufacturerName?: string;
  sourceFiles: string[];
}

export interface Dm2ImportIssue {
  id: string;
  type: Dm2ImportIssueType;
  severity: Dm2ImportIssueSeverity;
  message: string;
  rowIds?: string[];
  proposalId?: string;
}

export interface Dm2ImportSessionContext {
  sport?: string;
  year?: number;
  manufacturer?: string;
  brand?: string;
  cardSetCategory?: string;
  cardSetName?: string;
}

export interface Dm2ColumnMapping {
  sheetIndex: number;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columns: {
    sport?: number;
    year?: number;
    manufacturer?: number;
    brand?: number;
    cardSetCategory?: number;
    cardSetName?: number;
    cardNumber?: number;
    player?: number;
    parallel?: number;
  };
  defaultMetadata: Dm2ImportSessionContext;
  confidence: number;
  /** AI-identified column that combines card set name + parallel. */
  combinedCardSetColumn?: number;
  /** AI-provided split for each distinct combined CARD SET value in the file. */
  cardSetValueSplits?: Record<
    string,
    {
      cardSetName: string;
      parallel?: string | null;
      cardSetCategory?: string | null;
    }
  >;
}

export interface Dm2ImportFieldStats {
  sport: number;
  year: number;
  manufacturer: number;
  brand: number;
  cardSetCategory: number;
  cardSetName: number;
  parallel: number;
}

export interface Dm2ImportFileResult {
  fileName: string;
  status: "success" | "failed";
  error?: string;
  rowCount?: number;
}

export interface Dm2ImportReviewProgress {
  lookupsCommittedAt?: string;
  cardSetsCommittedAt?: string;
  cardsReviewCommittedAt?: string;
}

export interface Dm2ImportSession {
  id: string;
  files: Dm2ImportFileResult[];
  sessionContext: Dm2ImportSessionContext;
  rows: Dm2ExtractedRow[];
  proposals: Dm2LookupProposal[];
  issues: Dm2ImportIssue[];
  suggestions: Dm2FieldSuggestion[];
  researchNotes: Dm2ImportResearchNote[];
  mappingFramework: Dm2MappingFrameworkNote[];
  model: string;
  promptVersion: string;
  catalog?: Dm2ImportCatalogContext;
  reviewProgress?: Dm2ImportReviewProgress;
  duplicateResolutions?: Record<string, Dm2DuplicateResolution>;
}

export type Dm2DuplicateResolutionAction =
  | "confirmed_duplicate"
  | "not_duplicate";

export interface Dm2DuplicateResolution {
  action: Dm2DuplicateResolutionAction;
  issueType: "DUPLICATE_EXACT" | "DUPLICATE_NEAR";
  rowIds: string[];
  keepRowId?: string;
  resolvedAt: string;
}

export type Dm2ImportCommitErrorCode =
  | "pre_commit_validation"
  | "lookup_create_failed"
  | "brand_without_manufacturer"
  | "card_set_create_failed"
  | "row_incomplete"
  | "card_set_unresolved"
  | "batch_insert_failed"
  | "unexpected_shortfall";

export type Dm2ImportCommitDuplicateEntityType =
  | "sport"
  | "manufacturer"
  | "brand"
  | "cardSetCategory"
  | "cardSetName"
  | "parallel"
  | "cardSet"
  | "card";

export interface Dm2ImportCommitAddedStats {
  sports: number;
  manufacturers: number;
  brands: number;
  cardSetCategories: number;
  cardSetNames: number;
  parallels: number;
  cardSets: number;
  cards: number;
}

export interface Dm2ImportCommitDuplicateItem {
  id: string;
  entityType: Dm2ImportCommitDuplicateEntityType;
  label: string;
  detail?: string;
  rowId?: string;
  sourceFileName?: string;
}

export interface Dm2ImportCommitErrorItem {
  id: string;
  code: Dm2ImportCommitErrorCode;
  message: string;
  remedy: string;
  rowId?: string;
  sourceFileName?: string;
  sourceRowIndex?: number;
  cardNumber?: string;
  player?: string;
  cardSetName?: string;
}

export interface Dm2ImportCommitResult {
  error?: string;
  /** Legacy flat counters — kept for compatibility */
  sportsCreated?: number;
  manufacturersCreated?: number;
  brandsCreated?: number;
  cardSetCategoriesCreated?: number;
  cardSetNamesCreated?: number;
  parallelsCreated?: number;
  cardSetsCreated?: number;
  cardsCreated?: number;
  cardsSkipped?: number;
  cardsFailed?: number;
  warning?: string;
  /** Structured import summary */
  added?: Dm2ImportCommitAddedStats;
  duplicates?: Dm2ImportCommitDuplicateItem[];
  errors?: Dm2ImportCommitErrorItem[];
  /** True when some cards saved but row-level issues remain fixable in review */
  canReturnToReview?: boolean;
}

export interface Dm2ImportCatalogContext {
  entityDescriptions: Array<{
    entityKey: string;
    title: string;
    description: string;
    tableName?: string;
    sortOrder: number;
  }>;
  sports: Array<{ id: string; label: string; active: boolean }>;
  manufacturers: Array<{ id: string; name: string; active: boolean }>;
  brands: Array<{
    id: string;
    name: string;
    manufacturerId: string;
    manufacturerName: string;
    active: boolean;
  }>;
  cardSetCategories: Array<{ id: string; name: string; active: boolean }>;
  cardSetNames: Array<{ id: string; name: string; active: boolean }>;
  parallels: Array<{ id: string; name: string; active: boolean }>;
  cardSets: Array<{
    id: string;
    sportId: string;
    year: number;
    brandId: string;
    cardSetCategoryId: string;
    cardSetNameId: string;
  }>;
  /** Existing card set combinations from catalog — used to infer Insert/Subset categories */
  cardSetProfiles?: Array<{
    cardSetName: string;
    cardSetCategory: string;
    sportLabel: string;
    year: number;
    brandName: string;
    manufacturerName: string;
  }>;
  cards: Array<{
    id: string;
    cardSetId: string;
    cardNumber: string;
    player: string;
    parallelId: string | null;
  }>;
}
