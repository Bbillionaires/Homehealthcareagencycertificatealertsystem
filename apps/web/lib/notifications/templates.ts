import { formatDateLong } from "@compliance/shared";

/**
 * Plain-text email templates for the notification job (§13 of the
 * brief). Kept as small pure functions returning {subject, text} so the
 * job and any future preview/admin tooling can share them.
 */

export function expirationWarningEmail(params: {
  employeeName: string;
  credentialName: string;
  expirationDate: string;
  daysRemaining: number;
}) {
  return {
    subject: `${params.credentialName} Expiration Warning`,
    text: [
      `${params.credentialName} Expiration Warning`,
      "",
      `Employee: ${params.employeeName}`,
      `Credential: ${params.credentialName}`,
      `Expiration Date: ${formatDateLong(params.expirationDate)}`,
      `Days Remaining: ${params.daysRemaining}`,
      "",
      "Please arrange renewal before the expiration date.",
    ].join("\n"),
  };
}

export function urgentExpirationEmail(params: {
  employeeName: string;
  credentialName: string;
  expirationDate: string;
  daysRemaining: number;
}) {
  return {
    subject: `URGENT: ${params.credentialName} Expires Soon`,
    text: [
      `URGENT: ${params.credentialName} Expires Soon`,
      "",
      `Employee: ${params.employeeName}`,
      `Credential: ${params.credentialName}`,
      `Expiration Date: ${formatDateLong(params.expirationDate)}`,
      `Days Remaining: ${params.daysRemaining}`,
      "",
      "This credential requires immediate attention -- please arrange renewal right away.",
    ].join("\n"),
  };
}

export function expiredCredentialEmail(params: { employeeName: string; credentialName: string; expirationDate: string }) {
  return {
    subject: `${params.credentialName} Has Expired`,
    text: [
      `${params.credentialName} Has Expired`,
      "",
      `Employee: ${params.employeeName}`,
      `Credential: ${params.credentialName}`,
      `Expired On: ${formatDateLong(params.expirationDate)}`,
      "",
      `${params.employeeName} is now non-compliant for this requirement. Please arrange renewal as soon as possible.`,
    ].join("\n"),
  };
}

export function missingDocumentationEmail(params: { employeeName: string; credentialName: string }) {
  return {
    subject: `Missing Documentation: ${params.credentialName}`,
    text: [
      `Missing Documentation: ${params.credentialName}`,
      "",
      `Employee: ${params.employeeName}`,
      `Credential: ${params.credentialName}`,
      "",
      `${params.employeeName} has no record on file for this required credential. Please add the completion date and supporting document.`,
    ].join("\n"),
  };
}

export function renewalConfirmationEmail(params: {
  employeeName: string;
  credentialName: string;
  completionDate: string;
  expirationDate: string | null;
}) {
  return {
    subject: `${params.credentialName} Renewed`,
    text: [
      `${params.credentialName} Renewed`,
      "",
      `Employee: ${params.employeeName}`,
      `Credential: ${params.credentialName}`,
      `Completed: ${formatDateLong(params.completionDate)}`,
      `New Expiration Date: ${params.expirationDate ? formatDateLong(params.expirationDate) : "Never expires"}`,
      "",
      "This credential is now current.",
    ].join("\n"),
  };
}
