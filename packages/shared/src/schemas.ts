import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const employmentStatusSchema = z.enum(["active", "leave", "inactive", "terminated"]);

export const employeeInputSchema = z.object({
  employeeNumber: z.string().min(1, "Employee ID is required").max(50),
  firstName: z.string().min(1, "First name is required").max(100),
  middleName: z.string().max(100).optional().or(z.literal("")),
  lastName: z.string().min(1, "Last name is required").max(100),
  preferredName: z.string().max(100).optional().or(z.literal("")),
  dateOfHire: isoDate,
  positionId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  supervisorId: z.string().uuid().nullable().optional(),
  employmentStatus: employmentStatusSchema.default("active"),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export const credentialRenewalSchema = z.object({
  employeeId: z.string().uuid(),
  credentialTypeId: z.string().uuid(),
  completionDate: isoDate,
  issueDate: isoDate.optional(),
  expirationDate: isoDate.nullable().optional(),
  certificateNumber: z.string().max(100).optional().or(z.literal("")),
  issuingOrganization: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type CredentialRenewalInput = z.infer<typeof credentialRenewalSchema>;

export const expirationOverrideSchema = z.object({
  employeeCredentialId: z.string().uuid(),
  newExpirationDate: isoDate,
  reason: z.string().min(1, "A reason is required to override an expiration date").max(1000),
});

export const credentialTypeInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.enum(["training", "background_check", "document", "other"]),
  renewalIntervalValue: z.number().int().positive().nullable(),
  renewalIntervalUnit: z.enum(["days", "months", "years"]).nullable(),
  requiresDocument: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const signUpSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required").max(200),
  fullName: z.string().min(1, "Your name is required").max(200),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
