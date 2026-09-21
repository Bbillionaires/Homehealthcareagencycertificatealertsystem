import type { ComplianceColor } from "@compliance/shared";
import { Icon } from "./Icon";

const COLOR_CLASSES: Record<ComplianceColor, string> = {
  green: "bg-compliance-green-bg text-compliance-green-text ring-compliance-green-ring",
  yellow: "bg-compliance-yellow-bg text-compliance-yellow-text ring-compliance-yellow-ring",
  orange: "bg-compliance-orange-bg text-compliance-orange-text ring-compliance-orange-ring",
  red: "bg-compliance-red-bg text-compliance-red-text ring-compliance-red-ring",
  gray: "bg-compliance-gray-bg text-compliance-gray-text ring-compliance-gray-ring",
};

/**
 * Renders color + icon + text label together, always — compliance status
 * must never be conveyed by color alone (accessibility requirement).
 */
export function StatusBadge({
  color,
  icon,
  label,
}: {
  color: ComplianceColor;
  icon: "check-circle" | "clock" | "alert-triangle" | "x-circle" | "help-circle" | "minus-circle";
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${COLOR_CLASSES[color]}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
