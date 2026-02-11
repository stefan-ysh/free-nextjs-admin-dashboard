'use client';

import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FinanceRecordFormValues } from '@/lib/validations/finance';
import { InvoiceStatus, InvoiceType, PaymentType, TransactionType } from '@/types/finance';
import { getCategoryGroups, getPinnedCategoryLabels } from '@/constants/finance-categories';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import DatePicker from '@/components/ui/DatePicker';
import UserSelect from '@/components/common/UserSelect';
import { formatDateOnly } from '@/lib/dates';

const quickEntrySchema = z.object({
  type: z.nativeEnum(TransactionType),
  name: z.string().min(1, '名称不能为空'),
  category: z.string().min(1, '请选择分类'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, '日期格式不正确'),
  amount: z.number().min(0, '金额不能为负数'),
  paymentChannel: z.string().max(120, '支付方式过长').optional(),
  description: z.string().optional(),
  handlerId: z.string().optional(),
});

type QuickEntryValues = z.infer<typeof quickEntrySchema>;

interface QuickEntryFormProps {
  onSubmit: (data: FinanceRecordFormValues) => Promise<void>;
  onCancel?: () => void;
  incomeCategories: string[];
  expenseCategories: string[];
  currentUserId: string;
  formId?: string;
  hideActions?: boolean;
}

export default function QuickEntryForm({
  onSubmit,
  onCancel,
  incomeCategories,
  expenseCategories,
  currentUserId,
  formId,
  hideActions = false,
}: QuickEntryFormProps) {
  const [loading, setLoading] = useState(false);
  const categorySelectId = useId();

  const form = useForm<QuickEntryValues>({
    resolver: zodResolver(quickEntrySchema),
    defaultValues: {
      type: TransactionType.EXPENSE,
      name: '',
      category: '',
      date: formatDateOnly(new Date()) ?? '',
      amount: 0,
      paymentChannel: '',
      description: '',
      handlerId: currentUserId,
    },
  });

  const { watch, setValue } = form;
  const type = watch('type');
  const currentCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
  const categoryGroups = useMemo(() => {
    const labels = currentCategories.length ? currentCategories : undefined;
    return getCategoryGroups(type, labels, getPinnedCategoryLabels(type));
  }, [currentCategories, type]);

  const handleSubmit = async (values: QuickEntryValues) => {
    setLoading(true);
    try {
      const payload: FinanceRecordFormValues = {
        name: values.name,
        type: values.type,
        category: values.category,
        date: values.date,
        contractAmount: values.amount,
        fee: 0,
        quantity: 1,
        paymentType: PaymentType.FULL_PAYMENT,
        paymentChannel: values.paymentChannel?.trim() || '',
        payer: '',
        transactionNo: '',
        description: values.description || '',
        tags: [],
        invoice: {
          type: InvoiceType.NONE,
          status: InvoiceStatus.NOT_REQUIRED,
          number: '',
          issueDate: '',
          attachments: [],
        },
        handlerId: values.handlerId,
        status: 'draft',
        sourceType: 'manual',
      };
      await onSubmit(payload);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Tabs
          value={type}
          onValueChange={(val) => {
            setValue('type', val as TransactionType);
            setValue('category', '');
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value={TransactionType.INCOME}>收入</TabsTrigger>
            <TabsTrigger value={TransactionType.EXPENSE}>支出</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>明细名称 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="例如:外卖、交通费" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>金额 (元) <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    onChange={(event) => field.onChange(parseFloat(event.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>日期 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} required />
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
                <FormLabel htmlFor={categorySelectId}>分类 <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger id={categorySelectId} className="w-full">
                      <SelectValue placeholder="请选择分类" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {categoryGroups.map((group) => (
                      <SelectGroup key={`${type}-quick-${group.label}`}>
                        <SelectLabel className="text-xs text-muted-foreground">
                          {group.label}
                        </SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={`${group.label}-${option.label}`} value={option.label}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentChannel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>支付方式</FormLabel>
                <FormControl>
                  <Input placeholder="如：微信、现金、银行卡" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="handlerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>经办人</FormLabel>
                <FormControl>
                  <UserSelect value={field.value} onChange={field.onChange} placeholder="选择经办人" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>备注</FormLabel>
                <FormControl>
                  <Textarea placeholder="可选备注" className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!hideActions && (
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                取消
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? '提交中...' : '快速添加'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
