'use client';

import { useState } from 'react';
import { FinanceRecord, TransactionType, PaymentType, InvoiceType, InvoiceStatus } from '@/types/finance';
import FileUpload from './FileUpload';
import DatePicker from '../ui/DatePicker';

interface FinanceFormProps {
  initialData?: Partial<FinanceRecord>;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
  incomeCategories: string[];
  expenseCategories: string[];
}

export default function FinanceForm({
  initialData,
  onSubmit,
  onCancel,
  incomeCategories,
  expenseCategories,
}: FinanceFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || TransactionType.EXPENSE,
    contractAmount: initialData?.contractAmount || 0,
    fee: initialData?.fee || 0,
    category: initialData?.category || '',
    paymentType: initialData?.paymentType || PaymentType.FULL_PAYMENT,
    date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    description: initialData?.description || '',
    invoice: {
      type: initialData?.invoice?.type || InvoiceType.NONE,
      status: initialData?.invoice?.status || InvoiceStatus.NOT_REQUIRED,
      number: initialData?.invoice?.number || '',
      issueDate: initialData?.invoice?.issueDate?.split('T')[0] || '',
      attachments: initialData?.invoice?.attachments || [],
    },
  });

  // 根据类型获取当前分类列表
  const currentCategories = formData.type === TransactionType.INCOME 
    ? incomeCategories 
    : expenseCategories;

  // 计算总金额
  const totalAmount = formData.contractAmount + formData.fee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        ...formData,
        date: new Date(formData.date).toISOString(),
        invoice: formData.invoice.type === InvoiceType.NONE ? undefined : {
          ...formData.invoice,
          issueDate: formData.invoice.issueDate ? new Date(formData.invoice.issueDate).toISOString() : undefined,
        },
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('提交失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 明细名称 */}
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            明细名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="例如:办公室装修、员工工资"
          />
        </div>

        {/* 类型选择 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            收支类型 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value={TransactionType.INCOME}
                checked={formData.type === TransactionType.INCOME}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  type: e.target.value as TransactionType,
                  category: '' // 切换类型时重置分类
                })}
                className="mr-2"
              />
              <span className="text-green-600 dark:text-green-400">收入</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value={TransactionType.EXPENSE}
                checked={formData.type === TransactionType.EXPENSE}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  type: e.target.value as TransactionType,
                  category: '' // 切换类型时重置分类
                })}
                className="mr-2"
              />
              <span className="text-red-600 dark:text-red-400">支出</span>
            </label>
          </div>
        </div>

        {/* 分类 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            分类 <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">请选择分类</option>
            {currentCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 金额信息 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            合同金额 (元) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.contractAmount}
            onChange={(e) => setFormData({ ...formData, contractAmount: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            手续费 (元) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.fee}
            onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            总金额 (元)
          </label>
          <div className="flex h-[42px] items-center rounded-lg border border-gray-300 bg-gray-50 px-4 dark:border-gray-600 dark:bg-gray-800">
            <span className="font-semibold text-gray-900 dark:text-white">¥{totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 款项和日期 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            款项类型 <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.paymentType}
            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as PaymentType })}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={PaymentType.DEPOSIT}>定金</option>
            <option value={PaymentType.FULL_PAYMENT}>全款</option>
            <option value={PaymentType.INSTALLMENT}>分期</option>
            <option value={PaymentType.BALANCE}>尾款</option>
            <option value={PaymentType.OTHER}>其他</option>
          </select>
        </div>

        <DatePicker
          label="日期"
          required
          value={formData.date}
          onChange={(date) => setFormData({ ...formData, date })}
        />
      </div>

      {/* 发票信息 */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">发票信息</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              发票类型
            </label>
            <select
              value={formData.invoice.type}
              onChange={(e) => setFormData({ 
                ...formData, 
                invoice: { ...formData.invoice, type: e.target.value as InvoiceType }
              })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={InvoiceType.NONE}>无需发票</option>
              <option value={InvoiceType.GENERAL}>普通发票</option>
              <option value={InvoiceType.SPECIAL}>增值税专用发票</option>
            </select>
          </div>

          {formData.invoice.type !== InvoiceType.NONE && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  开票状态
                </label>
                <select
                  value={formData.invoice.status}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    invoice: { ...formData.invoice, status: e.target.value as InvoiceStatus }
                  })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value={InvoiceStatus.PENDING}>待开票</option>
                  <option value={InvoiceStatus.ISSUED}>已开票</option>
                </select>
              </div>

              {formData.invoice.status === InvoiceStatus.ISSUED && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      发票号码
                    </label>
                    <input
                      type="text"
                      value={formData.invoice.number}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        invoice: { ...formData.invoice, number: e.target.value }
                      })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="发票号码"
                    />
                  </div>

                  <DatePicker
                    label="开票日期"
                    value={formData.invoice.issueDate}
                    onChange={(date) => setFormData({ 
                      ...formData, 
                      invoice: { ...formData.invoice, issueDate: date }
                    })}
                  />

                  {/* 发票附件上传 */}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      发票附件
                    </label>
                    <FileUpload
                      files={formData.invoice.attachments || []}
                      onChange={(files) => setFormData({
                        ...formData,
                        invoice: { ...formData.invoice, attachments: files }
                      })}
                      maxFiles={5}
                      accept="image/*,.pdf"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
          备注
        </label>
        <textarea
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="补充说明..."
        />
      </div>

      {/* 按钮 */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            取消
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {loading ? '提交中...' : initialData ? '更新' : '添加'}
        </button>
      </div>
    </form>
  );
}
