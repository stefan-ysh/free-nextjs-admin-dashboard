import type { WarehousePayload } from '@/types/inventory';

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function sanitizeWarehousePayload(
  raw: Partial<WarehousePayload>
): Partial<WarehousePayload> {
  const payload: Partial<WarehousePayload> = { ...raw };
  if (raw.capacity !== undefined) {
    payload.capacity = toNumber(raw.capacity);
  }
  return payload;
}

export function validateWarehousePayload(
  payload: Partial<WarehousePayload>,
  { partial = false }: { partial?: boolean } = {}
): string | null {
  const required: Array<keyof WarehousePayload> = ['name', 'code', 'type'];

  if (!partial) {
    const missing = required.filter((key) => payload[key] === undefined || payload[key] === null);
    if (missing.length) {
      return `缺少必要字段：${missing.join(', ')}`;
    }
  }

  if (payload.type !== undefined && !['main', 'store', 'virtual'].includes(payload.type)) {
    return '仓库类型不正确';
  }

  if (payload.capacity !== undefined && !Number.isFinite(payload.capacity)) {
    return '仓库容量必须是有效数字';
  }
  if (payload.capacity !== undefined && payload.capacity < 0) {
    return '仓库容量必须大于等于 0';
  }

  return null;
}
