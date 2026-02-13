import { z } from 'zod';

import {
  INVOICE_STATUSES,
  INVOICE_TYPES,
  InvoiceStatus,
  InvoiceType,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PaymentMethod,
  PaymentType,
  PURCHASE_CHANNELS,
  PURCHASE_ORGANIZATIONS,
  PurchaseChannel,
  PurchaseOrganization,
} from '@/types/purchase';

const purchaseChannelEnum = z.enum(PURCHASE_CHANNELS as [PurchaseChannel, ...PurchaseChannel[]]);
const purchaseOrganizationEnum = z.enum(PURCHASE_ORGANIZATIONS as [PurchaseOrganization, ...PurchaseOrganization[]]);
const paymentMethodEnum = z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]);
const paymentTypeEnum = z.enum(PAYMENT_TYPES as [PaymentType, ...PaymentType[]]);
const invoiceTypeEnum = z.enum(INVOICE_TYPES as [InvoiceType, ...InvoiceType[]]);
const invoiceStatusEnum = z.enum(INVOICE_STATUSES as [InvoiceStatus, ...InvoiceStatus[]]);

export const purchaseFormSchema = z
  .object({
    purchaseDate: z.string().min(1, '请选择采购日期'),
    organizationType: purchaseOrganizationEnum,
    itemName: z.string().optional().nullable(),
    inventoryItemId: z.string().optional().nullable(),
    specification: z.string().optional().nullable(),
    quantity: z.coerce.number().min(0.01, '数量必须大于 0'),
    unitPrice: z.coerce.number().min(0.01, '单价必须大于 0'),
    feeAmount: z.coerce.number().min(0, '手续费不能为负数').default(0),
    purchaseChannel: purchaseChannelEnum,
    onlinePlatform: z.string().optional().nullable(),
    purchaseLocation: z.string().optional().nullable(),
    purchaseLink: z.string().optional().nullable(),
    purpose: z.string().min(1, '请填写采购用途'),
    paymentMethod: paymentMethodEnum,
    paymentType: paymentTypeEnum,
    paymentChannel: z.string().optional().nullable(),
    isProxyPayment: z.boolean().default(false).optional(),
    payerName: z.string().optional().nullable(),
    transactionNo: z.string().optional().nullable(),
    purchaserId: z.string().min(1, '请选择申请人'),
    hasInvoice: z.boolean().default(false),
    invoiceType: invoiceTypeEnum,
    invoiceStatus: invoiceStatusEnum,
    invoiceNumber: z.string().optional().nullable(),
    invoiceIssueDate: z.string().optional().nullable(),
    invoiceImages: z.array(z.string()).default([]),
    receiptImages: z.array(z.string()).default([]),
    notes: z.string().optional().nullable(),
    attachments: z.array(z.string()).default([]),
  })
  .superRefine((values, ctx) => {
    if (!values.inventoryItemId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择物品；若不存在请先新增物品',
        path: ['inventoryItemId'],
      });
    }

    if (values.purchaseChannel === 'online' && !values.purchaseLink?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '线上采购需要填写商品链接',
        path: ['purchaseLink'],
      });
    }
    if (values.purchaseChannel === 'online' && !values.onlinePlatform?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '线上采购需要选择网购平台',
        path: ['onlinePlatform'],
      });
    }

    if (values.purchaseChannel === 'offline' && !values.purchaseLocation?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '线下采购需要填写采购地点',
        path: ['purchaseLocation'],
      });
    }

    if (values.hasInvoice) {
      if (values.invoiceType === InvoiceType.NONE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '开启发票选项时，请选择发票类型',
          path: ['invoiceType'],
        });
      }
      if (values.invoiceStatus === InvoiceStatus.ISSUED) {
        if (!values.invoiceNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '请输入发票号码',
            path: ['invoiceNumber'],
          });
        }
        if (!values.invoiceIssueDate?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '请选择开票日期',
            path: ['invoiceIssueDate'],
          });
        }
      }
    }
  });

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;
