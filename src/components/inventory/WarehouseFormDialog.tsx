'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import type { Warehouse } from '@/types/inventory';

const warehouseTypes: Warehouse['type'][] = ['main', 'store', 'virtual'];
const warehouseTypeLabels: Record<Warehouse['type'], string> = {
  main: '主仓',
  store: '备件/门店',
  virtual: '虚拟仓',
};

const Required = () => <span className="ml-1 text-destructive">*</span>;

type FormValues = {
  name: string;
  code: string;
  type: Warehouse['type'];
  address: string;
  capacity: string;
  manager: string;
};

const buildDefaultValues = (warehouse?: Warehouse | null): FormValues => ({
  name: warehouse?.name ?? '',
  code: warehouse?.code ?? '',
  type: warehouse?.type ?? 'main',
  address: warehouse?.address ?? '',
  capacity: warehouse?.capacity != null ? String(warehouse.capacity) : '',
  manager: warehouse?.manager ?? '',
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
  onSuccess?: () => void;
};

export default function WarehouseFormDialog({ open, onOpenChange, warehouse, onSuccess }: Props) {
  const isEditMode = Boolean(warehouse);
  const form = useForm<FormValues>({
    defaultValues: buildDefaultValues(warehouse),
  });

  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(warehouse));
    }
  }, [open, warehouse, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      if (!values.name.trim() || !values.code.trim()) {
        throw new Error('请填写仓库名称与编码');
      }
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        code: values.code.trim(),
        type: values.type,
      };
      if (values.address.trim()) payload.address = values.address.trim();
      if (values.manager.trim()) payload.manager = values.manager.trim();
      if (values.capacity.trim()) {
        const parsed = Number(values.capacity);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error('容量需为大于等于 0 的数字');
        }
        payload.capacity = parsed;
      }

      const endpoint = isEditMode && warehouse ? `/api/inventory/warehouses/${warehouse.id}` : '/api/inventory/warehouses';
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

      toast.success(isEditMode ? '仓库已更新' : '仓库已创建');
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    }
  });

  const submitting = form.formState.isSubmitting;

  const formId = 'warehouse-form';

  return (
    <Drawer open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)} direction="right">
      <DrawerContent side="right" className="sm:max-w-xl">
        <div className="flex h-full flex-col">
          <DrawerHeader className="border-b px-6 py-4">
            <DrawerTitle>{isEditMode ? '编辑仓库' : '新建仓库'}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Form {...form}>
              <form id={formId} onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        仓库名称<Required />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="例如：广州总部仓" disabled={submitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        仓库编码<Required />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="例如：GZ-MAIN" disabled={submitting} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        仓库类型<Required />
                      </FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouseTypes.map((option) => (
                              <SelectItem key={option} value={option}>
                                {warehouseTypeLabels[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="manager"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>负责人</FormLabel>
                      <FormControl>
                        <Input placeholder="可选" disabled={submitting} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>仓库地址</FormLabel>
                      <FormControl>
                        <Input placeholder="地址可选" disabled={submitting} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>容量（㎡，可选）</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="10" disabled={submitting} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
              {isEditMode ? '保存修改' : '创建仓库'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
