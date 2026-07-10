export function dedupeByKey<T>(items: T[], keyFn: (item: T) => string | number) {
  const seen = new Map<string | number, T>()
  for (const item of items) {
    const key = keyFn(item)
    if (!seen.has(key)) seen.set(key, item)
  }
  return Array.from(seen.values())
}
