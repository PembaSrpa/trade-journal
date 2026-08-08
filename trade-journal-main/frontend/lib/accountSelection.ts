export function isCombinedSelection(id: string | null): boolean {
  return !!id && id.startsWith("combined:");
}

export function combinedAccountType(id: string | null): "demo" | "live" | null {
  if (!isCombinedSelection(id)) return null;
  return id!.split(":")[1] as "demo" | "live";
}
