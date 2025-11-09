'use client';

import { FinanceRecord, TransactionType, InvoiceStatus, PaymentType } from '@/types/finance';

interface FinanceTableProps {
  records: FinanceRecord[];
  onEdit: (record: FinanceRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export default function FinanceTable({
  records,
  onEdit,
  onDelete,
  loading = false,
}: FinanceTableProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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

  const getInvoiceStatusColor = (status?: InvoiceStatus) => {
    if (!status || status === InvoiceStatus.NOT_REQUIRED) return 'text-gray-500';
    return status === InvoiceStatus.ISSUED 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg">暂无记录</p>
          <p className="mt-2 text-sm">点击上方按钮添加第一条财务记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">日期</th>
            <th scope="col" className="px-6 py-3">名称</th>
            <th scope="col" className="px-6 py-3">类型</th>
            <th scope="col" className="px-6 py-3">分类</th>
            <th scope="col" className="px-6 py-3">合同金额</th>
            <th scope="col" className="px-6 py-3">手续费</th>
            <th scope="col" className="px-6 py-3">总金额</th>
            <th scope="col" className="px-6 py-3">款项类型</th>
            <th scope="col" className="px-6 py-3">发票状态</th>
            <th scope="col" className="px-6 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const totalAmount = record.contractAmount + record.fee;
            return (
              <tr
                key={record.id}
                className="border-b bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-600"
              >
                <td className="px-6 py-4 whitespace-nowrap">{formatDate(record.date)}</td>
                <td className="px-6 py-4">
                  <div className="max-w-[200px] truncate font-medium text-gray-900 dark:text-white" title={record.name}>
                    {record.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                      record.type === TransactionType.INCOME
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    }`}
                  >
                    {record.type === TransactionType.INCOME ? '收入' : '支出'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{record.category}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900 dark:text-white">
                    ¥{record.contractAmount.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-600 dark:text-gray-400">
                    ¥{record.fee.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`font-semibold ${
                      record.type === TransactionType.INCOME
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    ¥{totalAmount.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700 dark:text-gray-300">
                    {getPaymentTypeLabel(record.paymentType)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {record.invoice?.status && record.invoice.status !== InvoiceStatus.NOT_REQUIRED ? (
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2.5 py-0.5 text-xs font-medium ${getInvoiceStatusColor(record.invoice.status)}`}>
                        {getInvoiceStatusLabel(record.invoice.status)}
                      </span>
                      {record.invoice.status === InvoiceStatus.ISSUED && record.invoice.attachments && record.invoice.attachments.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400" title={`${record.invoice.attachments.length}个附件`}>
                          📎 {record.invoice.attachments.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => {
                      if (window.confirm('确定要删除这条记录吗?')) {
                        onDelete(record.id);
                      }
                    }}
                    className="font-medium text-red-600 hover:underline dark:text-red-500"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
