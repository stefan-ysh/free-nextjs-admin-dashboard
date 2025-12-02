'use client';

import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { financeRecordSchema, FinanceRecordFormValues } from '@/lib/validations/finance';
import { FinanceRecord, TransactionType, PaymentType, InvoiceType, InvoiceStatus } from '@/types/finance';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DatePicker from '@/components/ui/DatePicker';
import FileUpload from '@/components/common/FileUpload';
import { Label } from '@/components/ui/label';
import { getCategoryGroups } from '@/constants/finance-categories';
import UserSelect from '@/components/common/UserSelect';

interface FinanceFormProps {
  initialData?: Partial<FinanceRecord>;
  onSubmit: (data: FinanceRecordFormValues) => Promise<void>;
  onCancel?: () => void;
  incomeCategories: string[];
  expenseCategories: string[];
  currentUserId: string;
  formId?: string;
  hideActions?: boolean;
}

export type FinanceFormSubmitPayload = FinanceRecordFormValues;

export default function FinanceForm({
  initialData,
  onSubmit,
  onCancel,
  incomeCategories,
  expenseCategories,
  currentUserId,
  formId,
  hideActions = false,
}: FinanceFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(initialData?.id);
  const paymentChannelOptions = ['公对公', '公对私', '银行转账', '支付宝', '微信', '现金', '其他'];
  const categorySelectId = useId();

  const defaultValues: Partial<FinanceRecordFormValues> = {
    name: initialData?.name ?? '',
    type: initialData?.type ?? TransactionType.EXPENSE,
    contractAmount: initialData?.contractAmount ?? 0,
    fee: initialData?.fee ?? 0,
    quantity: initialData?.quantity ?? 1,
    category: initialData?.category ?? '',
    paymentType: initialData?.paymentType ?? PaymentType.FULL_PAYMENT,
    paymentChannel: initialData?.paymentChannel ?? '',
    payer: initialData?.payer ?? '',
    transactionNo: initialData?.transactionNo ?? '',
    date: initialData?.date?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    description: initialData?.description ?? '',
    tags: initialData?.tags ?? [],
    handlerId: (initialData?.metadata as any)?.handlerId ?? currentUserId,
    invoice: {
      type: initialData?.invoice?.type ?? InvoiceType.NONE,
      status: initialData?.invoice?.status ?? InvoiceStatus.NOT_REQUIRED,
      number: initialData?.invoice?.number ?? '',
      issueDate: initialData?.invoice?.issueDate?.split('T')[0] ?? '',
      attachments: initialData?.invoice?.attachments ?? [],
    },
  };

  const form = useForm<FinanceRecordFormValues>({
    resolver: zodResolver(financeRecordSchema),
    defaultValues,
  });

  const { watch, setValue } = form;
  const type = watch('type');
  const contractAmount = watch('contractAmount') || 0;
  const fee = watch('fee') || 0;
  const invoiceType = watch('invoice.type');
  const invoiceStatus = watch('invoice.status');

  const currentCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
  const totalAmount = contractAmount + fee;
  const categoryGroups = useMemo(() => {
    const labels = currentCategories.length ? currentCategories : undefined;
    return getCategoryGroups(type, labels);
  }, [currentCategories, type]);

  const handleSubmit = async (data: FinanceRecordFormValues) => {
    setLoading(true);
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs
          value={type}
          onValueChange={(val) => {
            setValue('type', val as TransactionType);
            setValue('category', ''); // Reset category on type change
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value={TransactionType.INCOME} className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-100">收入</TabsTrigger>
            <TabsTrigger value={TransactionType.EXPENSE} className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900 dark:data-[state=active]:bg-red-900 dark:data-[state=active]:text-red-100">支出</TabsTrigger>
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
                  <Input placeholder="例如:办公室装修、员工工资" {...field} />
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
                <Label htmlFor={categorySelectId} className="text-sm font-medium">
                  分类 <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger id={categorySelectId} className="w-full">
                      <SelectValue placeholder="请选择分类" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {categoryGroups.map((group) => (
                      <SelectGroup key={`${type}-${group.label}`}>
                        <SelectLabel className="text-xs text-muted-foreground">
                          {group.label}
                        </SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={option.label} value={option.label}>
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
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>日期 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    required
                  />
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
                  <UserSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="选择经办人"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>数量</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contractAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>合同金额 (元) <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>手续费 (元) <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">总金额 (元)</label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm ring-offset-background">
              <span className="font-semibold">¥{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="paymentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>款项类型 <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择款项类型" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={PaymentType.DEPOSIT}>定金</SelectItem>
                    <SelectItem value={PaymentType.FULL_PAYMENT}>全款</SelectItem>
                    <SelectItem value={PaymentType.INSTALLMENT}>分期</SelectItem>
                    <SelectItem value={PaymentType.BALANCE}>尾款</SelectItem>
                    <SelectItem value={PaymentType.OTHER}>其他</SelectItem>
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
                  <div>
                    <Input
                      placeholder="如：公对公、公对私"
                      list="payment-channel-options"
                      {...field}
                    />
                    <datalist id="payment-channel-options">
                      {paymentChannelOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="payer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>代付人</FormLabel>
                <FormControl>
                  <Input placeholder="可选，如有代付同事" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="transactionNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>流水号</FormLabel>
                <FormControl>
                  <Input
                    placeholder={isEditing ? '银行/支付平台流水号' : '保存后系统自动生成'}
                    readOnly={!isEditing}
                    {...field}
                  />
                </FormControl>
                {!isEditing && (
                  <p className="text-xs text-muted-foreground">保存后系统自动生成</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border-none p-4">
          <h3 className="mb-3 text-sm font-medium">发票信息</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="invoice.type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>发票类型</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择发票类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={InvoiceType.NONE}>无需发票</SelectItem>
                      <SelectItem value={InvoiceType.GENERAL}>普通发票</SelectItem>
                      <SelectItem value={InvoiceType.SPECIAL}>增值税专用发票</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {invoiceType !== InvoiceType.NONE && (
              <>
                <FormField
                  control={form.control}
                  name="invoice.status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>开票状态</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={InvoiceStatus.PENDING}>待开票</SelectItem>
                          <SelectItem value={InvoiceStatus.ISSUED}>已开票</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {invoiceStatus === InvoiceStatus.ISSUED && (
                  <>
                    <FormField
                      control={form.control}
                      name="invoice.number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>发票号码</FormLabel>
                          <FormControl>
                            <Input placeholder="发票号码" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="invoice.issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>开票日期</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="invoice.attachments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>发票附件</FormLabel>
                            <FormControl>
                              <FileUpload
                                files={field.value || []}
                                onChange={field.onChange}
                                maxFiles={5}
                                accept="image/*,.pdf"
                                folder="finance/attachments"
                                prefix="invoice"
                                buttonLabel="点击上传发票"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>备注</FormLabel>
              <FormControl>
                <Textarea placeholder="补充说明..." className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!hideActions && (
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                取消
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? '提交中...' : initialData ? '更新' : '添加'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
