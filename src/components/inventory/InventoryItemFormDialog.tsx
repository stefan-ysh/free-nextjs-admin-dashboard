'use client';

import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import type { InventoryItem } from '@/types/inventory';

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
  onSuccess?: () => void;
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

      const parsedSpecFields = values.specFields
        .map((field) => ({
          key: field.key.trim(),
          label: field.label.trim(),
          options: field.options
            .split(',')
            .map((option) => option.trim())
            .filter(Boolean),
          defaultValue: field.defaultValue.trim() || undefined,
        }))
        .filter((field) => field.key && field.label);
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
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? '保存失败');
      }

      toast.success(isEditMode ? '商品已更新' : '商品已创建');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    }
  });

  const submitting = form.formState.isSubmitting;

  const formId = 'inventory-item-form';

  return (
    <Drawer open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)} direction="right">
      <DrawerContent side="right" className="sm:max-w-3xl">
        <div className="flex h-full flex-col">
          <DrawerHeader className="border-b px-6 py-4">
            <DrawerTitle>{isEditMode ? '编辑商品' : '新建商品'}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Form {...form}>
              <form id={formId} onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-dashed border-muted p-3 text-sm text-muted-foreground">
                <p className="text-xs uppercase tracking-wide">SKU</p>
                <p className="font-mono text-base text-foreground">
                  {item?.sku ?? '保存后系统自动生成'}
                </p>
              </div>
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
                <div className="text-sm font-medium">规格字段</div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => specFieldArray.append({ key: '', label: '', options: '', defaultValue: '' })}
                >
                  添加
                </Button>
              </div>
              {specFieldArray.fields.length === 0 ? (
                <p className="rounded border border-dashed border-muted p-4 text-sm text-muted-foreground">
                  尚未添加规格字段。
                </p>
              ) : (
                <div className="space-y-3">
                  {specFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="rounded-xl border border-muted/60 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row">
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.key`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel>字段 Key</FormLabel>
                              <FormControl>
                                <Input placeholder="例如：glowColor" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.label`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel>显示名称</FormLabel>
                              <FormControl>
                                <Input placeholder="发光颜色" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.options`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel>可选值（逗号分隔）</FormLabel>
                              <FormControl>
                                <Input placeholder="蓝, 绿, 红" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`specFields.${index}.defaultValue`}
                          render={({ field: innerField }) => (
                            <FormItem className="flex-1">
                              <FormLabel>默认值</FormLabel>
                              <FormControl>
                                <Input placeholder="自动填充值" disabled={submitting} {...innerField} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          className="md:w-28"
                          onClick={() => specFieldArray.remove(index)}
                          disabled={submitting}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

              </form>
            </Form>
          </div>
          <DrawerFooter className="border-t px-6 py-4">
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
