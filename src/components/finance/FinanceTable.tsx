'use client';

import DataState from '@/components/common/DataState';
import { FinanceRecord, TransactionType, InvoiceStatus, PaymentType } from '@/types/finance';
import { formatDateTimeLocal } from '@/lib/dates';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/hooks/useConfirm';

interface FinanceTableProps {
  records: FinanceRecord[];
  onEdit: (record: FinanceRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function FinanceTable({
  records,
  onEdit,
  onDelete,
  loading = false,
  canEdit = true,
  canDelete = true,
}: FinanceTableProps) {
  const confirm = useConfirm();

  const handleDelete = async (record: FinanceRecord) => {
    const confirmed = await confirm({
      title: '确定要删除这条记录吗？',
      description: '此操作无法撤销。',
      confirmText: '删除',
      cancelText: '取消',
    });
    if (confirmed) {
      onDelete(record.id);
    }
  };
  const formatDate = (dateString: string) => {
    return formatDateTimeLocal(dateString) ?? dateString;
  };

  const getPaymentTypeLabel = (type: PaymentType) => {
    const labels = {
      [PaymentType.DEPOSIT]: '定金',
      [PaymentType.FULL_PAYMENT]: '全款',
      [PaymentType.INSTALLMENT]: '分期',
      [PaymentType.BALANCE]: '尾款',
      [PaymentType.OTHER]: '其他',
    };
    return labels[type] || type;
  };

  const getInvoiceStatusLabel = (status?: InvoiceStatus) => {
    if (!status || status === InvoiceStatus.NOT_REQUIRED) return '-';
    return status === InvoiceStatus.ISSUED ? '已开票' : '待开票';
  };



  if (loading) {
    return (
      <div className="p-6">
        <DataState
          variant="loading"
          title="正在加载财务记录"
          description="稍等一下，数据很快就绪"
          className="min-h-[200px]"
        />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-6">
        <DataState
          variant="empty"
          title="暂无财务记录"
          description="点击“添加记录”开始录入第一条数据"
          className="min-h-[200px]"
        />
      </div>
    );
  }

  return (
    <div className="rounded-none border-primary-200 dark:border-primary-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日期</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>数量</TableHead>
            <TableHead>合同金额</TableHead>
            <TableHead>手续费</TableHead>
            <TableHead>总金额</TableHead>
            <TableHead>支付方式</TableHead>
            <TableHead>代付/流水</TableHead>
            <TableHead>款项类型</TableHead>
            <TableHead>发票状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const totalAmount = record.contractAmount + record.fee;
            return (
              <TableRow key={record.id} className='border-none'>
                <TableCell>{formatDate(record.date)}</TableCell>
                <TableCell className="font-medium">
                  <div className="max-w-[200px] truncate" title={record.name}>
                    {record.name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={record.type === TransactionType.INCOME ? 'default' : 'destructive'}
                    className={record.type === TransactionType.INCOME ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {record.type === TransactionType.INCOME ? '收入' : '支出'}
                  </Badge>
                </TableCell>
                <TableCell>{record.category}</TableCell>
                <TableCell>{record.quantity ?? 1}</TableCell>
                <TableCell>¥{record.contractAmount.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">¥{record.fee.toFixed(2)}</TableCell>
                <TableCell className={record.type === TransactionType.INCOME ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                  ¥{totalAmount.toFixed(2)}
                </TableCell>
                <TableCell>{record.paymentChannel || '-'}</TableCell>
                <TableCell>
                  {record.payer || record.transactionNo ? (
                    <div className="space-y-1">
                      {record.payer && <div className="text-sm text-foreground">{record.payer}</div>}
                      {record.transactionNo && (
                        <div className="text-xs text-muted-foreground" title={record.transactionNo}>
                          流水: {record.transactionNo}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{getPaymentTypeLabel(record.paymentType)}</TableCell>
                <TableCell>
                  {record.invoice?.status && record.invoice.status !== InvoiceStatus.NOT_REQUIRED ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        record.invoice.status === InvoiceStatus.ISSUED
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }>
                        {getInvoiceStatusLabel(record.invoice.status)}
                      </Badge>
                      {record.invoice.status === InvoiceStatus.ISSUED && record.invoice.attachments && record.invoice.attachments.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const attachments = record.invoice?.attachments || [];
                            const firstAttachment = attachments[0];
                            const isImage = firstAttachment?.startsWith('data:image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(firstAttachment || '');

                            // Create a simple preview dialog
                            const dialog = document.createElement('div');
                            dialog.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
                            dialog.onclick = () => dialog.remove();

                            const content = document.createElement('div');
                            content.className = 'bg-white dark:bg-gray-900 rounded-lg p-4 max-w-2xl max-h-[80vh] overflow-auto';
                            content.onclick = (e) => e.stopPropagation();

                            const header = document.createElement('div');
                            header.className = 'flex items-center justify-between mb-3';
                            header.innerHTML = `
                              <h3 class="text-sm font-semibold">附件预览 (${attachments.length})</h3>
                              <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onclick="this.closest('.fixed').remove()">&times;</button>
                            `;

                            const grid = document.createElement('div');
                            grid.className = 'grid gap-3 md:grid-cols-2';

                            attachments.forEach((file, idx) => {
                              const item = document.createElement('div');
                              const isItemImage = file.startsWith('data:image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(file);

                              if (isItemImage) {
                                item.className = 'space-y-2';
                                item.innerHTML = `
                                  <img src="${file}" alt="附件 ${idx + 1}" class="w-full h-40 object-cover rounded border border-border" />
                                  <a href="${file}" target="_blank" class="text-xs text-blue-600 hover:underline dark:text-blue-400">新窗口查看</a>
                                `;
                              } else {
                                item.className = 'flex items-center justify-between rounded border border-border bg-muted/50 px-3 py-2';
                                item.innerHTML = `
                                  <span class="text-xs">附件 ${idx + 1}</span>
                                  <a href="${file}" target="_blank" class="text-xs text-blue-600 hover:underline dark:text-blue-400">打开</a>
                                `;
                              }
                              grid.appendChild(item);
                            });

                            content.appendChild(header);
                            content.appendChild(grid);
                            dialog.appendChild(content);
                            document.body.appendChild(dialog);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                          title={`点击预览 ${record.invoice.attachments.length} 个附件`}
                        >
                          📎 {record.invoice.attachments.length}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit || canDelete ? (
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(record)}
                          className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          编辑
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(record)}
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">无权限</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
