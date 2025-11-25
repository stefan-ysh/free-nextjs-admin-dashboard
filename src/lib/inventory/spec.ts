import type { InventorySpecField } from '@/types/inventory';

export function specFieldsToDefaultRecord(
  specFields?: InventorySpecField[] | null
): Record<string, string> | undefined {
  if (!specFields || !specFields.length) {
    return undefined;
  }

  const entries: Array<[string, string]> = [];
  for (const field of specFields) {
    const value = field.defaultValue?.trim();
    if (field.key && value) {
      entries.push([field.key, value]);
    }
  }

  return entries.length ? Object.fromEntries(entries) : undefined;
}
