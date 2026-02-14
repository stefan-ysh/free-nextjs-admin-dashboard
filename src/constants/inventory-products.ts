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
    id: 'material-elwire',
    sku: 'MAT-ELWIRE',
    name: '电致发光丝',
    unit: '米',
    unitPrice: 95,
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
    category: template.category,
    safetyStock: template.safetyStock,
    specFields: template.specFields,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * (index + 1)).toISOString(),
    updatedAt: now.toISOString(),
  }));
}
