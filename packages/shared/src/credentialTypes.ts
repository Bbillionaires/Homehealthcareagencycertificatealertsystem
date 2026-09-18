import type { CredentialTypeDefinition } from "./types";

/**
 * The nine initially-required credential/training and background-check
 * items. Used to bootstrap a brand-new organization's credential type
 * catalog on signup — after that, everything here is just data rows an
 * administrator can rename, retire, or reconfigure.
 */
export const DEFAULT_CREDENTIAL_TYPES: CredentialTypeDefinition[] = [
  { key: "cpr", name: "CPR", category: "training", renewalIntervalValue: 2, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 1 },
  { key: "first_aid", name: "First Aid", category: "training", renewalIntervalValue: 2, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 2 },
  { key: "hipaa", name: "HIPAA", category: "training", renewalIntervalValue: 1, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 3 },
  { key: "zero_tolerance", name: "Zero Tolerance", category: "training", renewalIntervalValue: 3, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 4 },
  { key: "hiv_aids_101", name: "HIV/AIDS 101", category: "training", renewalIntervalValue: 2, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 5 },
  { key: "direct_care_core_competencies", name: "Direct Care Core Competencies", category: "training", renewalIntervalValue: 1, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 6 },
  { key: "letter_of_moral_character", name: "Letter of Moral Character", category: "document", renewalIntervalValue: null, renewalIntervalUnit: null, requiresDocument: true, sortOrder: 7 },
  { key: "local_background_check", name: "Local Background Check", category: "background_check", renewalIntervalValue: 5, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 8 },
  { key: "fdle_background_check", name: "FDLE Background Check", category: "background_check", renewalIntervalValue: 5, renewalIntervalUnit: "years", requiresDocument: true, sortOrder: 9 },
];
