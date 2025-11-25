import type { InventoryItem, InventorySpecField } from '@/types/inventory';

interface ProductTemplate {
  /** Stable identifier stored在 inventory_items.id */
  id: string;
  /** 人类可读 SKU，直接在商品管理中展示 */
  sku: string;
  name: string;
  /** 计量单位，例如“米”“升” */
  unit: string;
  /** 默认单价，可在后台调整 */
  unitPrice: number;
  /** 默认建议售价，可单独定价，不传则按 20% 毛利生成 */
  salePrice?: number;
  category: string;
  /** 安全库存，用于低库存预警 */
  safetyStock: number;
  /** 规格字段，增删对象即可，无需手写 JSON */
  specFields: InventorySpecField[];
}

/**
 * 修改或新增商品时，只需维护此对象数组即可。
 * 数据会在初始化时自动写入 inventory_items 表。
 */
export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    id: 'material-fiber',
    sku: 'MAT-FIBER',
    name: '发光纤维',
    unit: '米',
    unitPrice: 68,
    salePrice: 82,
    category: '原材料',
    safetyStock: 200,
    specFields: [
      { key: 'appearanceColor', label: '外观颜色', options: ['银白', '透明', '炫彩'], defaultValue: '银白' },
      { key: 'glowColor', label: '发光颜色', options: ['蓝', '绿', '红', '黄'], defaultValue: '蓝' },
      { key: 'glowIntensity', label: '发光强度', options: ['标准', '高亮', '超亮'], defaultValue: '高亮' },
      { key: 'glowDuration', label: '自发光时间', options: ['2h', '4h', '8h', '12h'], defaultValue: '4h' },
    ],
  },
  {
    id: 'material-paint',
    sku: 'MAT-PAINT',
    name: '发光漆',
    unit: '升',
    unitPrice: 320,
    salePrice: 384,
    category: '原材料',
    safetyStock: 80,
    specFields: [
      { key: 'appearanceColor', label: '外观颜色', options: ['白', '透明', '灰'], defaultValue: '白' },
      { key: 'glowColor', label: '发光颜色', options: ['蓝', '绿', '黄', '粉'], defaultValue: '绿' },
      { key: 'paintType', label: '漆类型', options: ['底漆', '清漆'], defaultValue: '底漆' },
      { key: 'glowIntensity', label: '发光强度', options: ['标准', '高亮', '超亮'], defaultValue: '高亮' },
      { key: 'glowDuration', label: '自发光时间', options: ['4h', '8h', '10h', '12h'], defaultValue: '8h' },
    ],
  },
  {
    id: 'material-film',
    sku: 'MAT-FILM',
    name: '发光膜',
    unit: '米',
    unitPrice: 210,
    salePrice: 252,
    category: '原材料',
    safetyStock: 120,
    specFields: [
      { key: 'appearanceColor', label: '外观颜色', options: ['透明', '乳白'], defaultValue: '透明' },
      { key: 'glowColor', label: '发光颜色', options: ['蓝', '绿', '粉'], defaultValue: '蓝' },
      { key: 'glowIntensity', label: '发光强度', options: ['标准', '高亮', '超亮'], defaultValue: '高亮' },
      { key: 'glowDuration', label: '自发光时间', options: ['4h', '8h', '10h', '12h'], defaultValue: '10h' },
      { key: 'width', label: '膜宽', options: ['25cm'], defaultValue: '25cm' },
    ],
  },
  {
    id: 'material-elwire',
    sku: 'MAT-ELWIRE',
    name: '电致发光丝',
    unit: '米',
    unitPrice: 95,
    salePrice: 114,
    category: '原材料',
    safetyStock: 150,
    specFields: [
      { key: 'appearanceColor', label: '外观颜色', options: ['白', '黑', '透明'], defaultValue: '白' },
      { key: 'glowColor', label: '发光颜色', options: ['蓝', '绿', '橙', '紫'], defaultValue: '橙' },
      { key: 'diameter', label: '直径大小', options: ['0.3mm', '0.4mm', '0.5mm'], defaultValue: '0.4mm' },
      { key: 'glowIntensity', label: '发光强度', options: ['标准', '高亮', '超亮'], defaultValue: '高亮' },
    ],
  },
];

export function buildInventoryItemsFromTemplates(): InventoryItem[] {
  const now = new Date();
  return PRODUCT_TEMPLATES.map((template, index) => ({
    id: template.id,
    sku: template.sku,
    name: template.name,
    unit: template.unit,
    unitPrice: template.unitPrice,
    salePrice: template.salePrice ?? Number((template.unitPrice * 1.2).toFixed(2)),
    category: template.category,
    safetyStock: template.safetyStock,
    specFields: template.specFields,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * (index + 1)).toISOString(),
    updatedAt: now.toISOString(),
  }));
}
