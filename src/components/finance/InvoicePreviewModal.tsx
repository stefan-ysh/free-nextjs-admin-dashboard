'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FinanceRecord,
  InvoiceStatus,
  InvoiceType,
  TransactionType,
} from '@/types/finance';
import { formatDateTimeLocal } from '@/lib/dates';

interface InvoicePreviewModalProps {
  record: FinanceRecord;
  onClose: () => void;
}

const invoiceTypeLabel: Record<InvoiceType, string> = {
  [InvoiceType.SPECIAL]: '增值税专用发票',
  [InvoiceType.GENERAL]: '普通发票',
  [InvoiceType.NONE]: '无需发票',
};

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  [InvoiceStatus.ISSUED]: '已开票',
  [InvoiceStatus.PENDING]: '待开票',
  [InvoiceStatus.NOT_REQUIRED]: '无需开票',
};

const transactionTypeLabel: Record<TransactionType, string> = {
  [TransactionType.INCOME]: '收入',
  [TransactionType.EXPENSE]: '支出',
};

export default function InvoicePreviewModal({ record, onClose }: InvoicePreviewModalProps) {
  const invoice = record.invoice;

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  if (!invoice || invoice.type === InvoiceType.NONE) {
    return null;
  }

  const attachments = invoice.attachments ?? [];

  const renderAttachment = (file: string, index: number) => {
    const lower = file.toLowerCase();
    const isPdf = file.startsWith('data:application/pdf') || lower.endsWith('.pdf');
    const isImage =
      file.startsWith('data:image/') || /\.(png|jpe?g|gif|bmp|webp)$/.test(lower);

    if (isImage) {
      return (
        <div key={index} className="space-y-2">
          <Image
            src={file}
            alt={`发票附件 ${index + 1}`}
            width={1200}
            height={800}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="w-full rounded-lg border border-border object-contain"
            unoptimized
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>图片附件 {index + 1}</span>
            <a
              href={file}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              新窗口查看
            </a>
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground"
        >
          <span>PDF 附件 {index + 1}</span>
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            下载预览
          </a>
        </div>
      );
    }

    return (
      <div
        key={index}
        className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground"
      >
        <span>附件 {index + 1}</span>
        <a
          href={file}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          打开
        </a>
      </div>
    );
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8" onClick={onClose}>
      <div className="panel-frame relative max-h-full w-full max-w-3xl overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="关闭预览"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-6">
          <header>
            <p className="text-sm text-muted-foreground">发票预览</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">{record.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {transactionTypeLabel[record.type]} · {formatDateTimeLocal(record.date) ?? record.date}
            </p>
          </header>

          <section className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">发票类型</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {invoiceTypeLabel[invoice.type]}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">开票状态</p>
              <span
                className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                  invoice.status === InvoiceStatus.ISSUED
                    ? 'bg-chart-5/15 text-chart-5'
                    : 'bg-chart-3/20 text-chart-3'
                }`}
              >
                {invoiceStatusLabel[invoice.status]}
              </span>
            </div>
            {invoice.number && (
              <div>
                <p className="text-xs text-muted-foreground">发票号码</p>
                <p className="mt-1 text-sm font-medium text-foreground">{invoice.number}</p>
              </div>
            )}
            {invoice.issueDate && (
              <div>
                <p className="text-xs text-muted-foreground">开票日期</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTimeLocal(invoice.issueDate) ?? invoice.issueDate}
                </p>
              </div>
            )}
          </section>

          <section className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">合同金额</p>
              <p className="mt-1 text-lg font-semibold text-foreground">¥{record.contractAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">手续费</p>
              <p className="mt-1 text-lg font-semibold text-foreground">¥{record.fee.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总金额</p>
              <p className="mt-1 text-lg font-semibold text-foreground">¥{record.totalAmount.toFixed(2)}</p>
            </div>
            {record.description && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">备注</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{record.description}</p>
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">发票附件</h3>
              <span className="text-xs text-muted-foreground">{attachments.length} 个附件</span>
            </div>
            {attachments.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {attachments.map((file, index) => renderAttachment(file, index))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                暂无附件
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
