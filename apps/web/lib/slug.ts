export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "organization"
  );
}

export function slugWithSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(base)}-${suffix}`;
}
