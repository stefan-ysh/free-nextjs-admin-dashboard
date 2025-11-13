'use client';

import { useState } from 'react';
import DatePicker from '@/components/form/date-picker';
import Select from '@/components/form/Select';
import Label from '@/components/form/Label';
import EmployeeSelector from '@/components/common/EmployeeSelector';
import ImageUploader from '@/components/common/ImageUploader';
import ProjectSelector from '@/components/common/ProjectSelector';
import {
  PurchaseRecord,
  CreatePurchaseInput,
  PurchaseChannel,
  PaymentMethod,
  InvoiceType,
} from '@/types/purchase';

type PurchaseFormProps = {
  initialData?: PurchaseRecord | null;
  onSubmit: (data: CreatePurchaseInput) => Promise<void>;
  onCancel?: () => void;
};

const CHANNEL_OPTIONS = [
  { value: 'online', label: '线上购买' },
  { value: 'offline', label: '线下购买' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'corporate_transfer', label: '对公转账' },
  { value: 'cash', label: '现金' },
];

const INVOICE_TYPE_OPTIONS: { value: InvoiceType; label: string }[] = [
  { value: 'none', label: '无发票' },
  { value: 'general', label: '普票' },
  { value: 'special', label: '专票' },
];

export default function PurchaseForm({ initialData, onSubmit, onCancel }: PurchaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({
    purchaseDate: initialData?.purchaseDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    itemName: initialData?.itemName ?? '',
    specification: initialData?.specification ?? '',
    quantity: initialData?.quantity?.toString() ?? '1',
    unitPrice: initialData?.unitPrice?.toString() ?? '',
    purchaseChannel: (initialData?.purchaseChannel ?? 'online') as PurchaseChannel,
    purchaseLocation: initialData?.purchaseLocation ?? '',
    purchaseLink: initialData?.purchaseLink ?? '',
    purpose: initialData?.purpose ?? '',
    paymentMethod: (initialData?.paymentMethod ?? 'wechat') as PaymentMethod,
    purchaserId: initialData?.purchaserId ?? '', // will use current user if empty
    invoiceType: (initialData?.invoiceType ?? 'none') as InvoiceType,
    hasProject: initialData?.hasProject ?? false,
    projectId: initialData?.projectId ?? '',
    notes: initialData?.notes ?? '',
  });

  const [invoiceImages, setInvoiceImages] = useState<string[]>(initialData?.invoiceImages ?? []);
  const [receiptImages, setReceiptImages] = useState<string[]>(initialData?.receiptImages ?? []);
  const totalAmount = (() => {
    const q = parseFloat(formState.quantity) || 0;
    const u = parseFloat(formState.unitPrice) || 0;
    return (q * u).toFixed(2);
  })();

  const handleChange = (field: string, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formState.itemName.trim()) {
      alert('请填写物品名称');
      return;
    }
    if (!formState.purpose.trim()) {
      alert('请填写用途说明');
      return;
    }
    const quantity = parseFloat(formState.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('请填写有效的数量');
      return;
    }
    const unitPrice = parseFloat(formState.unitPrice);
    if (isNaN(unitPrice) || unitPrice < 0) {
      alert('请填写有效的单价');
      return;
    }
    if (formState.purchaseChannel === 'online' && !formState.purchaseLink.trim()) {
      alert('线上购买需要填写购买链接');
      return;
    }
    if (formState.purchaseChannel === 'offline' && !formState.purchaseLocation.trim()) {
      alert('线下购买需要填写购买地点');
      return;
    }
    if (formState.hasProject && !formState.projectId) {
      alert('已选择关联项目，请选择具体项目');
      return;
    }

    setLoading(true);
    try {
      const payload: CreatePurchaseInput = {
        purchaseDate: formState.purchaseDate,
        itemName: formState.itemName.trim(),
        specification: formState.specification.trim() || undefined,
        quantity,
        unitPrice,
        purchaseChannel: formState.purchaseChannel,
        purchaseLocation: formState.purchaseLocation.trim() || undefined,
        purchaseLink: formState.purchaseLink.trim() || undefined,
        purpose: formState.purpose.trim(),
        paymentMethod: formState.paymentMethod,
        purchaserId: formState.purchaserId || undefined,
        invoiceType: formState.invoiceType,
        invoiceImages: invoiceImages.length > 0 ? invoiceImages : undefined,
        receiptImages: receiptImages.length > 0 ? receiptImages : undefined,
        hasProject: formState.hasProject,
        projectId: formState.projectId || undefined,
        notes: formState.notes.trim() || undefined,
      };

      await onSubmit(payload);
    } catch (error) {
      console.error('提交失败', error);
      alert('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">基本信息</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <DatePicker
              id="purchaseDate"
              label="购买日期 *"
              defaultDate={formState.purchaseDate}
              onChange={(selectedDates) => {
                if (selectedDates.length > 0) {
                  const date = new Date(selectedDates[0]);
                  handleChange('purchaseDate', date.toISOString().split('T')[0]);
                }
              }}
            />
          </div>

          <div>
            <Label htmlFor="itemName">物品名称 *</Label>
            <input
              id="itemName"
              type="text"
              value={formState.itemName}
              onChange={(e) => handleChange('itemName', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              placeholder="请输入物品名称"
              required
            />
          </div>

          <div>
            <Label htmlFor="specification">规格型号</Label>
            <input
              id="specification"
              type="text"
              value={formState.specification}
              onChange={(e) => handleChange('specification', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              placeholder="可选"
            />
          </div>

          <div>
            <Label htmlFor="quantity">数量 *</Label>
            <input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={formState.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              required
            />
          </div>

          <div>
            <Label htmlFor="unitPrice">单价 (¥) *</Label>
            <input
              id="unitPrice"
              type="number"
              step="0.01"
              min="0"
              value={formState.unitPrice}
              onChange={(e) => handleChange('unitPrice', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              required
            />
          </div>

          <div>
            <Label>总金额</Label>
            <div className="flex h-11 items-center rounded-lg border border-gray-300 bg-gray-50 px-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              ¥{totalAmount}
            </div>
          </div>
        </div>
      </div>

      {/* 购买信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">购买信息</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="purchaseChannel">购买渠道 *</Label>
            <Select
              options={CHANNEL_OPTIONS}
              defaultValue={formState.purchaseChannel}
              onChange={(value) => handleChange('purchaseChannel', value)}
            />
          </div>

          {formState.purchaseChannel === 'online' ? (
            <div>
              <Label htmlFor="purchaseLink">购买链接 *</Label>
              <input
                id="purchaseLink"
                type="url"
                value={formState.purchaseLink}
                onChange={(e) => handleChange('purchaseLink', e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                placeholder="https://..."
                required
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="purchaseLocation">购买地点 *</Label>
              <input
                id="purchaseLocation"
                type="text"
                value={formState.purchaseLocation}
                onChange={(e) => handleChange('purchaseLocation', e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                placeholder="请输入购买地点"
                required
              />
            </div>
          )}

          <div className="md:col-span-2">
            <Label htmlFor="purpose">用途说明 *</Label>
            <textarea
              id="purpose"
              value={formState.purpose}
              onChange={(e) => handleChange('purpose', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              placeholder="请说明购买用途"
              required
            />
          </div>
        </div>
      </div>

      {/* 付款信息 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">付款信息</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="paymentMethod">付款方式 *</Label>
            <Select
              options={PAYMENT_METHOD_OPTIONS}
              defaultValue={formState.paymentMethod}
              onChange={(value) => handleChange('paymentMethod', value)}
            />
          </div>

          <div>
            <EmployeeSelector
              label="付款人"
              value={formState.purchaserId || undefined}
              onChange={(id) => handleChange('purchaserId', id || '')}
              placeholder="默认为当前用户"
            />
          </div>

          <div>
            <Label htmlFor="invoiceType">发票类型 *</Label>
            <Select
              options={INVOICE_TYPE_OPTIONS}
              defaultValue={formState.invoiceType}
              onChange={(value) => handleChange('invoiceType', value)}
            />
          </div>

          <div className="md:col-span-2">
            <ImageUploader
              label="发票图片"
              images={invoiceImages}
              onChange={setInvoiceImages}
              maxImages={5}
            />
          </div>

          <div className="md:col-span-2">
            <ImageUploader
              label="小票图片"
              images={receiptImages}
              onChange={setReceiptImages}
              maxImages={5}
            />
          </div>
        </div>
      </div>

      {/* 项目关联 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">项目关联</h3>
        <div className="flex items-center gap-3">
          <input
            id="hasProject"
            type="checkbox"
            checked={formState.hasProject}
            onChange={(e) => handleChange('hasProject', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <Label htmlFor="hasProject" className="mb-0">
            此采购关联项目
          </Label>
        </div>
        {formState.hasProject && (
          <div className="mt-4">
            <ProjectSelector
              value={formState.projectId}
              onChange={(projectId) => handleChange('projectId', projectId || '')}
              label="选择项目"
              placeholder="请选择关联项目"
              required
            />
          </div>
        )}
      </div>

      {/* 备注 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">备注</h3>
        <textarea
          id="notes"
          value={formState.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          placeholder="可选，其他需要说明的信息"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-hidden focus:ring-3 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {loading ? '保存中...' : initialData ? '更新' : '创建'}
        </button>
      </div>
    </form>
  );
}
