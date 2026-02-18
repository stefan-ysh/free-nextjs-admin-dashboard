"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ChevronDown, ChevronUp } from 'lucide-react';

import InventoryItemSelector from '@/components/common/InventoryItemSelector';
import FileUpload from '@/components/common/FileUpload';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDateOnly } from '@/lib/dates';
import { purchaseFormSchema, type PurchaseFormValues } from '@/lib/validations/purchase';

import {
  INVOICE_TYPES,
  InvoiceStatus,
  InvoiceType,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
  PURCHASE_CHANNEL_LABELS,
  PURCHASE_CHANNELS,
  PURCHASE_ORGANIZATION_LABELS,
  PURCHASE_ORGANIZATIONS,
  PurchaseChannel,
  PurchaseOrganization,
  type PurchaseRecord,
  PaymentMethod,
  PaymentType,
} from '@/types/purchase';

const SECTION_CARD_CLASS = 'surface-panel p-6';
const FIELD_FULL = 'w-full';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;



const ONLINE_PLATFORMS = [
  '京东',
  '淘宝',
  '天猫',
  '拼多多',
  '1688',
  '抖音商城',
  '苏宁易购',
  '亚马逊 Amazon',
  'eBay',
  'AliExpress',
  'Shopee',
  'Lazada',
] as const;
const DEFAULT_ONLINE_PLATFORM = '京东';

const toDateInputValue = (value?: string | null, fallbackToday = false): string => {
  if (!value) return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
  const trimmed = value.trim();
  if (!trimmed) return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
  if (ISO_DATE_PATTERN.test(trimmed)) return trimmed;
  const [dateSegment] = trimmed.split('T');
  if (dateSegment && ISO_DATE_PATTERN.test(dateSegment)) return dateSegment;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
  return formatDateOnly(parsed) ?? '';
};

export type PurchaseFormSubmitPayload = {
  purchaseDate: string;
  organizationType: PurchaseOrganization;
  itemName: string;
  inventoryItemId: string | null;
  specification: string | null;
  quantity: number;
  unitPrice: number;
  feeAmount: number;
  purchaseChannel: PurchaseChannel;
  purchaseLocation: string | null;
  purchaseLink: string | null;
  purpose: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  paymentChannel: string | null;
  payerName: string | null;
  transactionNo: string | null;
  purchaserId: string;
  invoiceType: InvoiceType;
  invoiceStatus: InvoiceStatus;
  invoiceNumber: string | null;
  invoiceIssueDate: string | null;
  invoiceImages: string[];
  receiptImages: string[];
  notes: string | null;
  attachments: string[];
};

type PurchaseFormProps = {
  mode: 'create' | 'edit';
  initialData?: PurchaseRecord | null;
  currentUserId: string;
  onSubmit: (payload: PurchaseFormSubmitPayload) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
};

export default function PurchaseForm({
  mode,
  initialData,
  currentUserId,
  onSubmit,
  onCancel,
  disabled = false,
}: PurchaseFormProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const defaultValues = useMemo<PurchaseFormValues>(() => {
    const defaultChannel = initialData?.purchaseChannel ?? 'online';
    const invoiceType = initialData?.invoiceType ?? InvoiceType.NONE;
    const hasInvoice = invoiceType !== InvoiceType.NONE;

    return {
      purchaseDate: toDateInputValue(initialData?.purchaseDate, true),
      organizationType: initialData?.organizationType ?? 'company',
      itemName: initialData?.itemName ?? '',
      inventoryItemId: initialData?.inventoryItemId ?? null,
      specification: initialData?.specification ?? '',
      quantity: initialData?.quantity ?? 1,
      unitPrice: initialData?.unitPrice ?? 0,
      feeAmount: initialData?.feeAmount ?? 0,
      purchaseChannel: defaultChannel,
      onlinePlatform:
        defaultChannel === 'online'
          ? initialData?.purchaseLocation ?? DEFAULT_ONLINE_PLATFORM
          : '',
      purchaseLocation: initialData?.purchaseLocation ?? '',
      purchaseLink: initialData?.purchaseLink ?? '',
      purpose: initialData?.purpose ?? '',
      paymentMethod: initialData?.paymentMethod ?? 'wechat',
      paymentType: initialData?.paymentType ?? PaymentType.FULL_PAYMENT,
      paymentChannel: initialData?.paymentChannel ?? '',
      isProxyPayment: false,
      payerName: initialData?.payerName ?? '',
      transactionNo: initialData?.transactionNo ?? '',
      purchaserId: currentUserId,
      hasInvoice,
      invoiceType,
      invoiceStatus: initialData?.invoiceStatus ?? (hasInvoice ? InvoiceStatus.PENDING : InvoiceStatus.NOT_REQUIRED),
      invoiceNumber: initialData?.invoiceNumber ?? '',
        invoiceIssueDate: toDateInputValue(initialData?.invoiceIssueDate),
        invoiceImages: [],
        receiptImages: [],
        notes: initialData?.notes ?? '',
        attachments: initialData?.attachments ?? [],
    };
  }, [initialData, currentUserId]);

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    form.setValue('purchaserId', currentUserId, { shouldDirty: false, shouldValidate: true });
  }, [currentUserId, form]);

  const values = form.watch();
  const isSubmitting = form.formState.isSubmitting || disabled;
  const isOnlinePurchase = values.purchaseChannel === 'online';
  const hasInvoice = values.hasInvoice;
  const contractAmount = Number(values.quantity || 0) * Number(values.unitPrice || 0);

  const handlePurchaseChannelChange = (channel: PurchaseChannel) => {
    if (channel === 'online') {
      form.setValue('purchaseLocation', '', { shouldDirty: true, shouldValidate: true });
      form.setValue('onlinePlatform', DEFAULT_ONLINE_PLATFORM, { shouldDirty: true, shouldValidate: true });
    } else {
      form.setValue('purchaseLink', '', { shouldDirty: true, shouldValidate: true });
      form.setValue('onlinePlatform', '', { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      const inventoryItemId = data.inventoryItemId?.trim() ?? '';
      if (!inventoryItemId) {
        form.setError('inventoryItemId', { message: '请选择物品；若不存在请先新增物品' });
        return;
      }

      const itemName = data.itemName?.trim() ?? '';
      if (!itemName) {
        form.setError('inventoryItemId', { message: '请选择物品；若不存在请先新增物品' });
        return;
      }

      const effectiveInvoiceType = data.hasInvoice ? data.invoiceType : InvoiceType.NONE;
      const effectiveInvoiceStatus =
        effectiveInvoiceType === InvoiceType.NONE ? InvoiceStatus.NOT_REQUIRED : data.invoiceStatus ?? InvoiceStatus.PENDING;

      const payload: PurchaseFormSubmitPayload = {
        purchaseDate: data.purchaseDate?.trim() || formatDateOnly(new Date()) || '',
        organizationType: data.organizationType,
        itemName,
        inventoryItemId: data.inventoryItemId?.trim() || null,
        specification: data.specification?.trim() || null,
        quantity: Number(data.quantity),
        unitPrice: Number(data.unitPrice),
        feeAmount: Number(data.feeAmount) || 0,
        purchaseChannel: data.purchaseChannel,
        purchaseLocation:
          data.purchaseChannel === 'online'
            ? data.onlinePlatform?.trim() || null
            : data.purchaseLocation?.trim() || null,
        purchaseLink: data.purchaseChannel === 'online' ? data.purchaseLink?.trim() || null : null,
        purpose: data.purpose.trim(),
        paymentMethod: data.paymentMethod,
        paymentType: data.paymentType,
        paymentChannel: null,
        payerName: null,
        transactionNo: null,
        purchaserId: currentUserId,
        invoiceType: effectiveInvoiceType,
        invoiceStatus: effectiveInvoiceStatus,
        invoiceNumber: effectiveInvoiceStatus === InvoiceStatus.ISSUED ? data.invoiceNumber?.trim() || null : null,
        invoiceIssueDate:
          effectiveInvoiceStatus === InvoiceStatus.ISSUED && data.invoiceIssueDate?.trim()
            ? data.invoiceIssueDate.trim()
            : null,
        invoiceImages: [],
        receiptImages: [],
        notes: data.notes?.trim() || null,
        attachments: data.attachments.filter(Boolean),
      };

      await onSubmit(payload);
    } catch (error) {
      console.error('保存采购信息失败', error);
      toast.error(error instanceof Error ? error.message : '保存失败，请稍后再试');
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-6">
          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-center justify-start gap-3">
              <h3 className="text-base font-semibold text-foreground">基本信息</h3>
              <p className="text-xs text-muted-foreground">选择物品并填写采购基础信息</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <FormField
                control={form.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <FormItem className={`${FIELD_FULL} lg:col-span-2`}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      选择物品 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <InventoryItemSelector
                        value={field.value ?? ''}
                        onChange={(id, item) => {
                          field.onChange(id || null);
                          form.clearErrors('inventoryItemId');
                          form.setValue('itemName', item?.name ?? '', { shouldValidate: true });
                        }}
                        disabled={isSubmitting}
                        placeholder="请选择"
                        helperText="若列表中没有，点击下拉底部“新增物品”后再选择"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specification"
                render={({ field }) => (
                  <FormItem className={`${FIELD_FULL} lg:col-span-2`}>
                    <FormLabel className="text-sm font-medium text-foreground">规格 / 型号</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="可选，例如: M3 Pro / 36GB"
                        disabled={isSubmitting}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">采购日期</FormLabel>
                    <FormControl>
                      <DatePicker
                        required
                        placeholder="选择采购日期"
                        value={field.value}
                        onChange={field.onChange}
                        clearable={false}
                        disabled={isSubmitting}
                        containerClassName="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationType"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">采购组织</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择采购组织" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURCHASE_ORGANIZATIONS.map((org) => (
                            <SelectItem key={org} value={org}>
                              {PURCHASE_ORGANIZATION_LABELS[org]}
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
                name="quantity"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      数量 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      单价 (元) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="feeAmount"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">手续费 (元)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="w-full">
                <p className="mb-2 text-sm font-medium text-muted-foreground">合同金额 (元)</p>
                <div className="flex h-11 items-center rounded-xl bg-muted/50 px-4 text-sm font-semibold text-foreground">
                  ¥{contractAmount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-center justify-start gap-3">
              <h3 className="text-base font-semibold text-foreground">采购与付款</h3>
              <p className="text-xs text-muted-foreground">渠道、用途与付款信息</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <FormField
                control={form.control}
                name="purchaseChannel"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      采购渠道 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: PurchaseChannel) => {
                        field.onChange(value);
                        handlePurchaseChannelChange(value);
                      }}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择采购渠道" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PURCHASE_CHANNELS.map((channel) => (
                          <SelectItem key={channel} value={channel}>
                            {PURCHASE_CHANNEL_LABELS[channel]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOnlinePurchase ? (
                <>
                  <FormField
                    control={form.control}
                    name="onlinePlatform"
                    render={({ field }) => (
                      <FormItem className={FIELD_FULL}>
                        <FormLabel className="text-sm font-medium text-foreground">
                          网购平台 <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择网购平台" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ONLINE_PLATFORMS.map((platform) => (
                              <SelectItem key={platform} value={platform}>
                                {platform}
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
                    name="purchaseLink"
                    render={({ field }) => (
                      <FormItem className={`${FIELD_FULL} lg:col-span-2`}>
                        <FormLabel className="text-sm font-medium text-foreground">
                          商品链接 <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：https://item.jd.com/..."
                            disabled={isSubmitting}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="purchaseLocation"
                  render={({ field }) => (
                    <FormItem className={`${FIELD_FULL} lg:col-span-2`}>
                      <FormLabel className="text-sm font-medium text-foreground">
                        线下地点 <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：上海·徐家汇 Apple 授权店"
                          disabled={isSubmitting}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      款项类型 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择款项类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {PAYMENT_TYPE_LABELS[type]}
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
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className={FIELD_FULL}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      付款方式 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择付款方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {PAYMENT_METHOD_LABELS[method]}
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
                name="purpose"
                render={({ field }) => (
                  <FormItem className={`${FIELD_FULL} lg:col-span-4 xl:col-span-6`}>
                    <FormLabel className="text-sm font-medium text-foreground">
                      采购用途 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="说明采购背景、预算归属或审批依据"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-center justify-start gap-3">
              <h3 className="text-base font-semibold text-foreground">发票与凭证</h3>
              <div className="flex items-center gap-2">
                <Switch
                  checked={hasInvoice}
                  onCheckedChange={(checked) => {
                    form.setValue('hasInvoice', checked, { shouldDirty: true, shouldValidate: true });
                    if (!checked) {
                      form.setValue('invoiceType', InvoiceType.NONE, { shouldDirty: true, shouldValidate: true });
                      form.setValue('invoiceStatus', InvoiceStatus.NOT_REQUIRED, { shouldDirty: true, shouldValidate: true });
                    } else if (form.getValues('invoiceType') === InvoiceType.NONE) {
                      form.setValue('invoiceType', InvoiceType.GENERAL, { shouldDirty: true, shouldValidate: true });
                      form.setValue('invoiceStatus', InvoiceStatus.PENDING, { shouldDirty: true, shouldValidate: true });
                    }
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {hasInvoice ? (
              <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormField
                  control={form.control}
                  name="invoiceType"
                  render={({ field }) => (
                    <FormItem className={FIELD_FULL}>
                      <FormLabel className="text-sm font-medium text-foreground">发票类型</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value: InvoiceType) => field.onChange(value === InvoiceType.NONE ? InvoiceType.GENERAL : value)}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择发票类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INVOICE_TYPES.filter((type) => type !== InvoiceType.NONE).map((type) => (
                            <SelectItem key={type} value={type}>
                              {INVOICE_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
          </div>

          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-center justify-start gap-3">
              <h3 className="text-base font-semibold text-foreground">更多选项</h3>
              <div className="cursor-pointer" onClick={() => setShowOptionalFields((prev) => !prev)}>
                {showOptionalFields ? <ChevronUp /> : <ChevronDown />}
              </div>
            </div>

            {showOptionalFields ? (
              <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className={`${FIELD_FULL} lg:col-span-4 xl:col-span-6`}>
                      <FormLabel className="text-sm font-medium text-foreground">备注</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="审批人需要知晓的补充说明"
                          disabled={isSubmitting}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attachments"
                  render={({ field }) => (
                    <FormItem className={`${FIELD_FULL} lg:col-span-3 xl:col-span-4`}>
                      <FormLabel className="text-sm font-medium text-foreground">附件</FormLabel>
                      <FormControl>
                        <FileUpload
                          files={field.value || []}
                          onChange={field.onChange}
                          maxFiles={8}
                          folder="purchases/attachments"
                          prefix="attachment"
                          buttonLabel="上传附件"
                          helperText="可上传合同、报价单等辅助材料"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-border/60 bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="min-w-[100px]"
            >
              取消
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
            {isSubmitting ? (mode === 'create' ? '提交中...' : '保存中...') : mode === 'create' ? '提交采购申请' : '保存修改'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
