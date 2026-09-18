/**
 * Mirrors the seeded rows in industry_definitions (db/migrations/
 * 0003_multi_industry.sql) -- kept as a static list here (like
 * DEFAULT_CREDENTIAL_TYPES) so the signup form doesn't need a round
 * trip just to render its options. The database row is still the
 * source of truth `lib/organizations.ts` looks up by key.
 */
export const INDUSTRIES = [
  { key: "healthcare", name: "Healthcare" },
  { key: "construction", name: "Construction" },
  { key: "transportation", name: "Transportation" },
  { key: "childcare", name: "Childcare" },
  { key: "security", name: "Security" },
  { key: "education", name: "Education" },
  { key: "government_contracting", name: "Government Contracting" },
  { key: "staffing", name: "Staffing" },
  { key: "custom", name: "Other / Custom" },
] as const;

export type IndustryKey = (typeof INDUSTRIES)[number]["key"];
