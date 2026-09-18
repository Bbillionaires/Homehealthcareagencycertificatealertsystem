// Minimal inline icon set (no external icon library dependency yet).
// Paths adapted from Heroicons (MIT licensed).
const PATHS: Record<string, string> = {
  "check-circle":
    "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  clock: "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "alert-triangle":
    "M12 9v3.75m0 3h.008M10.29 3.86l-8.18 14.18A1.5 1.5 0 0 0 3.38 20.5h17.24a1.5 1.5 0 0 0 1.27-2.46L13.7 3.86a1.5 1.5 0 0 0-2.6 0Z",
  "x-circle": "M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "help-circle":
    "M9.879 7.519a3 3 0 1 1 3.844 4.582.75.75 0 0 0-.25.6V13.5m.001 3h-.002M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
