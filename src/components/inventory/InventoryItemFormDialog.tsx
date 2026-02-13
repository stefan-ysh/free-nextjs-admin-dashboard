'use client';

import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import ImageUpload from '@/components/common/ImageUpload';
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import type { InventoryItem } from '@/types/inventory';
import { FORM_DRAWER_WIDTH_STANDARD } from '@/components/common/form-drawer-width';

const Required = () => <span className="ml-1 text-destructive">*</span>;

const BASE_CATEGORY_OPTIONS = ['原材料', '半成品', '成品', '配件', '耗材'];
const BASE_UNIT_OPTIONS = ['米', '升', '件', '套', 'kg', '箱'];

type SpecFieldRow = { key: string; label: string; options: string; defaultValue: string };

type FormValues = {
  name: string;
  unit: string;
  unitPrice: string;
  salePrice: string;
  category: string;
  safetyStock: string;
  barcode: string;
  imageUrl: string;
  specFields: SpecFieldRow[];
};

const buildDefaultValues = (item?: InventoryItem | null): FormValues => ({
  name: item?.name ?? '',
  unit: item?.unit ?? BASE_UNIT_OPTIONS[0],
  unitPrice: item?.unitPrice != null ? String(item.unitPrice) : '',
  salePrice: item?.salePrice != null ? String(item.salePrice) : '',
  category: item?.category ?? BASE_CATEGORY_OPTIONS[0],
  safetyStock: item?.safetyStock != null ? String(item.safetyStock) : '',
  barcode: item?.barcode ?? '',
  imageUrl: item?.imageUrl ?? '',
  specFields:
    item?.specFields?.map((field) => ({
      key: field.key,
      label: field.label,
      options: (field.options ?? []).join(', '),
      defaultValue: field.defaultValue ?? '',
    })) ?? [],
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem | null;
  onSuccess?: (item: InventoryItem) => void;
};

export default function InventoryItemFormDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const isEditMode = Boolean(item);
  const form = useForm<FormValues>({
    defaultValues: buildDefaultValues(item),
  });

  const specFieldArray = useFieldArray({ control: form.control, name: 'specFields' });

  const categoryOptions = useMemo(() => {
    const list = [...BASE_CATEGORY_OPTIONS];
    if (item?.category && !list.includes(item.category)) {
      list.push(item.category);
    }
    return list;
  }, [item?.category]);

  const unitOptions = useMemo(() => {
    const list = [...BASE_UNIT_OPTIONS];
    if (item?.unit && !list.includes(item.unit)) {
      list.push(item.unit);
    }
    return list;
  }, [item?.unit]);

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(item));
    }
  }, [open, item, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      if (!values.name.trim() || !values.unit.trim()) {
        throw new Error('请填写名称和计量单位');
      }
      if (!values.unitPrice.trim() || Number(values.unitPrice) < 0) {
        throw new Error('请输入有效的商品单价');
      }
      if (!values.salePrice.trim() || Number(values.salePrice) < 0) {
        throw new Error('请输入有效的建议售价');
      }
      if (!values.safetyStock.trim() || Number(values.safetyStock) < 0) {
        throw new Error('请输入有效的安全库存');
      }

      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        unit: values.unit.trim(),
        unitPrice: Number(values.unitPrice),
        salePrice: Number(values.salePrice),
        category: values.category.trim() || '未分类',
        safetyStock: Number(values.safetyStock),
      };
      if (values.barcode.trim()) {
        payload.barcode = values.barcode.trim();
      }
      if (values.imageUrl) {
        payload.imageUrl = values.imageUrl;
      }

      const parsedSpecFields = values.specFields
        .map((field) => {
          const label = field.label.trim();
          if (!label) return null;

          // Auto-generate key if missing
          let key = field.key.trim();
          if (!key) {
            key = `attr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          }

          return {
            key,
            label,
            options: [], // Hidden in UI, default to empty
            defaultValue: field.defaultValue.trim() || undefined,
          };
        })
        .filter((field) => field !== null);

      if (parsedSpecFields.length) {
        payload.specFields = parsedSpecFields;
      }

      const endpoint = isEditMode && item ? `/api/inventory/items/${item.id}` : '/api/inventory/items';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { data?: InventoryItem; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? '保存失败');
      }

      toast.success(isEditMode ? '商品已更新' : '商品已创建');
      if (body.data) {
        onSuccess?.(body.data);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    }
  });

  const submitting = form.formState.isSubmitting;

  const formId = 'inventory-item-form';

  return (
    <Drawer open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)} direction="right">
      <DrawerContent side="right" className={FORM_DRAWER_WIDTH_STANDARD}>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? '编辑商品' : '新建商品'}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <Form {...form}>
            <form id={formId} onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商品图片</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value}
                            onChange={field.onChange}
                            folder="inventory"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="rounded border border-dashed border-muted p-3 text-sm text-muted-foreground">
                    <p className="text-xs uppercase tracking-wide">SKU</p>
                    <p className="font-mono text-base text-foreground">
                      {item?.sku ?? '保存后系统自动生成'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          商品名称<Required />
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="请输入商品名称" disabled={submitting} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>类别</FormLabel>
                        <Select disabled={submitting} value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择类别" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          计量单位<Required />
                        </FormLabel>
                        <Select disabled={submitting} value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择计量单位" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">

                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        单价 (¥)<Required />
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" disabled={submitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        建议售价 (¥)<Required />
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" disabled={submitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="safetyStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        安全库存<Required />
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" disabled={submitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>条码</FormLabel>
                      <FormControl>
                        <Input placeholder="可选" disabled={submitting} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">商品参数 (自定义字段)</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => specFieldArray.append({ key: '', label: '', options: '', defaultValue: '' })}
                  >
                    添加参数
                  </Button>
                </div>
                {specFieldArray.fields.length === 0 ? (
                  <p className="rounded border border-dashed border-muted p-4 text-sm text-muted-foreground">
                    尚未添加参数。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {specFieldArray.fields.map((field, index) => (
                      <div key={field.id} className="relative flex items-end gap-3 rounded-xl border border-muted/60 p-3 shadow-sm">
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.label`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs text-muted-foreground">参数名</FormLabel>
                              <FormControl>
                                <Input placeholder="例如：颜色、尺寸" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.defaultValue`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs text-muted-foreground">参数值</FormLabel>
                              <FormControl>
                                <Input placeholder="例如：红色、XL" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        {/* Hidden key field to persist existing keys */}
                        <input type="hidden" {...form.register(`specFields.${index}.key`)} />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => specFieldArray.remove(index)}
                          disabled={submitting}
                        >
                          <span className="sr-only">删除</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </form>
          </Form>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
          </DrawerClose>
          <Button type="submit" form={formId} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? '保存修改' : '创建商品'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
