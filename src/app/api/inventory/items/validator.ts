import type { InventoryItemPayload, InventorySpecField } from '@/types/inventory';

function isSpecFieldArray(value: unknown): value is InventorySpecField[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every(
    (field) =>
      field &&
      typeof field === 'object' &&
      typeof field.key === 'string' &&
      typeof field.label === 'string' &&
      (field.defaultValue === undefined || typeof field.defaultValue === 'string') &&
      (field.options === undefined ||
        (Array.isArray(field.options) && field.options.every((option: unknown) => typeof option === 'string')))
  );
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function sanitizeItemPayload(
  raw: Partial<InventoryItemPayload>
): Partial<InventoryItemPayload> {
  const payload: Partial<InventoryItemPayload> = { ...raw };
  if (raw.safetyStock !== undefined) {
    payload.safetyStock = toNumber(raw.safetyStock);
  }
  return payload;
}

export function validateItemPayload(
  payload: Partial<InventoryItemPayload>,
  { partial = false }: { partial?: boolean } = {}
): string | null {
  const required: Array<keyof InventoryItemPayload> = [
    'name',
    'unit',
    'category',
    'safetyStock',
  ];
  if (payload.sku !== undefined) {
    if (typeof payload.sku !== 'string' || !payload.sku.trim()) {
      return 'SKU 不能为空';
    }
  }


  if (!partial) {
    const missing = required.filter((key) => payload[key] === undefined || payload[key] === null);
    if (missing.length) {
      return `缺少必要字段：${missing.join(', ')}`;
    }
  }

  if (payload.safetyStock !== undefined && !Number.isFinite(payload.safetyStock)) {
    return '安全库存必须是有效数字';
  }
  if (payload.safetyStock !== undefined && payload.safetyStock < 0) {
    return '安全库存必须大于等于 0';
  }

  if (payload.specFields !== undefined && !isSpecFieldArray(payload.specFields)) {
    return '规格字段格式不正确';
  }

  return null;
}
