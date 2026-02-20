import { z } from 'zod';

export const inventorySpecFieldSchema = z.object({
  key: z.string().min(1, '规格键不能为空'),
  label: z.string().min(1, '规格名称不能为空'),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const inventoryItemSchema = z.object({
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, '商品名称不能为空'),
  unit: z.string().trim().min(1, '单位不能为空'),
  category: z.string().trim().min(1, '分类不能为空'),
  safetyStock: z.coerce.number().min(0, '安全库存必须大于等于 0').default(0),
  imageUrl: z.string().trim().url('图片链接格式不正确').optional().or(z.literal('')),
  specFields: z.array(inventorySpecFieldSchema).optional(),
});

export const inventoryItemUpdateSchema = inventoryItemSchema.partial();
