const CATEGORY_ALIASES: Record<string, string> = {
  chemicals: '化学试剂',
  reagents: '化学试剂',
  'chemical reagent': '化学试剂',
  'chemical reagents': '化学试剂',
  '化学药品': '化学试剂',
  '生化试剂': '化学试剂',

  consumables: '实验耗材',
  glassware: '实验耗材',
  'lab consumables': '实验耗材',
  '实验用品': '实验耗材',

  equipment: '仪器设备',
  devices: '仪器设备',

  tools: '工具器具',
  tool: '工具器具',

  office: '办公用品',
  stationery: '办公用品',
  '办公文具': '办公用品',

  safety: '劳保防护',
  'safety supplies': '劳保防护',

  testing: '检测样品',
  test: '检测样品',

  pantry: '生活物资',
  kitchen: '生活物资',

  service: '服务费用',
  services: '服务费用',

  'raw materials': '原材料',
  'raw material': '原材料',
  material: '原材料',
  materials: '原材料',

  semi: '半成品',
  'semi-finished': '半成品',
  'semi finished': '半成品',

  finished: '成品',

  accessory: '配件',
  accessories: '配件',

  other: '未分类',
  others: '未分类',
  misc: '未分类',
};

export const INVENTORY_CATEGORY_OPTIONS = [
  '化学试剂',
  '实验耗材',
  '原材料',
  '半成品',
  '成品',
  '配件',
  '仪器设备',
  '工具器具',
  '办公用品',
  '劳保防护',
  '检测样品',
  '生活物资',
  '服务费用',
  '未分类',
] as const;

function normalizeAliasKey(input: string): string {
  return input.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function normalizeInventoryCategory(input?: string | null): string {
  const raw = (input ?? '').trim();
  if (!raw) return '未分类';

  if ((INVENTORY_CATEGORY_OPTIONS as readonly string[]).includes(raw)) {
    return raw;
  }

  const alias = CATEGORY_ALIASES[normalizeAliasKey(raw)];
  if (alias) return alias;

  return raw;
}

export function getInventoryCategoryLabel(input?: string | null): string {
  return normalizeInventoryCategory(input);
}

