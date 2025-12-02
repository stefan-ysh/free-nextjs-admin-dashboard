'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import FileUpload from '@/components/common/FileUpload';
import UserSelect from '@/components/common/UserSelect';
import ProjectSelector from '@/components/common/ProjectSelector';
import SupplierSelector from '@/components/common/SupplierSelector';
import {
	INVOICE_TYPES,
	INVOICE_STATUSES,
	PAYMENT_METHODS,
	PAYMENT_TYPES,
	PURCHASE_CHANNELS,
	InvoiceStatus,
	PaymentType,
	type InvoiceType as PurchaseInvoiceType,
	type PaymentMethod,
	type PurchaseChannel,
	type PurchaseRecord,
} from '@/types/purchase';
import { InvoiceType as FinanceInvoiceType } from '@/types/finance';

const channelLabels: Record<PurchaseChannel, string> = {
	online: '线上采购',
	offline: '线下采购',
};

const paymentLabels: Record<PaymentMethod, string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};

const paymentTypeLabels: Record<PaymentType, string> = {
	[PaymentType.DEPOSIT]: '定金',
	[PaymentType.FULL_PAYMENT]: '全款',
	[PaymentType.INSTALLMENT]: '分期',
	[PaymentType.BALANCE]: '尾款',
	[PaymentType.OTHER]: '其他',
};

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
	[InvoiceStatus.PENDING]: '待开票',
	[InvoiceStatus.ISSUED]: '已开票',
	[InvoiceStatus.NOT_REQUIRED]: '无需开票',
};

const paymentChannelSuggestions = ['公对公', '公对私', '银行转账', '支付宝', '微信', '现金', '其他'];

const invoiceLabels: Record<PurchaseInvoiceType, string> = {
	[FinanceInvoiceType.SPECIAL]: '增值税专票',
	[FinanceInvoiceType.GENERAL]: '普通发票',
	[FinanceInvoiceType.NONE]: '无需发票',
};

const SECTION_CARD_CLASS = 'rounded-2xl bg-white/90 p-6 shadow-sm dark:bg-gray-900/40';

type PurchaseFormState = {
	purchaseDate: string;
	itemName: string;
	specification: string;
	quantity: number;
	unitPrice: number;
	feeAmount: number;
	purchaseChannel: PurchaseChannel;
	purchaseLocation: string;
	purchaseLink: string;
	purpose: string;
	paymentMethod: PaymentMethod;
	paymentType: PaymentType;
	paymentChannel: string;
	payerName: string;
	isProxyPayment: boolean;
	transactionNo: string;
	purchaserId: string;
	supplierId: string;
	invoiceType: PurchaseInvoiceType;
	invoiceStatus: InvoiceStatus;
	invoiceNumber: string;
	invoiceIssueDate: string;
	invoiceImages: string[];
	receiptImages: string[];
	attachments: string[];
	hasProject: boolean;
	projectId: string;
	notes: string;
};

export type PurchaseFormSubmitPayload = {
	purchaseDate: string;
	itemName: string;
	specification?: string | null;
	quantity: number;
	unitPrice: number;
	feeAmount?: number;
	purchaseChannel: PurchaseChannel;
	purchaseLocation?: string | null;
	purchaseLink?: string | null;
	purpose: string;
	paymentMethod: PaymentMethod;
	paymentType: PaymentType;
	paymentChannel?: string | null;
	payerName?: string | null;
	transactionNo?: string | null;
	purchaserId?: string;
	supplierId?: string | null;
	invoiceType: PurchaseInvoiceType;
	invoiceStatus?: InvoiceStatus;
	invoiceNumber?: string | null;
	invoiceIssueDate?: string | null;
	invoiceImages?: string[];
	receiptImages?: string[];
	hasProject: boolean;
	projectId?: string | null;
	notes?: string | null;
	attachments?: string[];
};

type PurchaseFormProps = {
	mode: 'create' | 'edit';
	initialData?: PurchaseRecord | null;
	currentUserId: string;
	onSubmit: (payload: PurchaseFormSubmitPayload) => Promise<void>;
	onCancel?: () => void;
	disabled?: boolean;
};

function getISODate(value?: string | null): string {
	if (!value) {
		return new Date().toISOString().split('T')[0];
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value.split('T')[0] ?? value;
	}
	return date.toISOString().split('T')[0];
}

function buildInitialState(purchase: PurchaseRecord | null | undefined, currentUserId: string): PurchaseFormState {
	const invoiceType = purchase?.invoiceType ?? FinanceInvoiceType.NONE;
	const invoiceStatus =
		purchase?.invoiceStatus ??
		(invoiceType === FinanceInvoiceType.NONE ? InvoiceStatus.NOT_REQUIRED : InvoiceStatus.PENDING);

	return {
		purchaseDate: getISODate(purchase?.purchaseDate),
		itemName: purchase?.itemName ?? '',
		specification: purchase?.specification ?? '',
		quantity: purchase?.quantity ?? 1,
		unitPrice: purchase?.unitPrice ?? 0,
		feeAmount: purchase?.feeAmount ?? 0,
		purchaseChannel: purchase?.purchaseChannel ?? 'online',
		purchaseLocation: purchase?.purchaseLocation ?? '',
		purchaseLink: purchase?.purchaseLink ?? '',
		purpose: purchase?.purpose ?? '',
		paymentMethod: purchase?.paymentMethod ?? 'wechat',
		paymentType: purchase?.paymentType ?? PaymentType.FULL_PAYMENT,
		paymentChannel: purchase?.paymentChannel ?? '',
		payerName: purchase?.payerName ?? '',
		transactionNo: purchase?.transactionNo ?? '',
		isProxyPayment: Boolean(purchase?.payerName),
		purchaserId: purchase?.purchaserId ?? currentUserId,
		supplierId: purchase?.supplierId ?? '',
		invoiceType,
		invoiceStatus,
		invoiceNumber: purchase?.invoiceNumber ?? '',
		invoiceIssueDate: purchase?.invoiceIssueDate ? getISODate(purchase.invoiceIssueDate) : '',
		invoiceImages: purchase?.invoiceImages ?? [],
		receiptImages: purchase?.receiptImages ?? [],
		attachments: purchase?.attachments ?? [],
		hasProject: purchase?.hasProject ?? false,
		projectId: purchase?.projectId ?? '',
		notes: purchase?.notes ?? '',
	};
}

function toISODateString(value: string): string {
	if (!value) return new Date().toISOString();
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return new Date().toISOString();
	}
	return date.toISOString();
}

export default function PurchaseForm({ mode, initialData, currentUserId, onSubmit, onCancel, disabled = false }: PurchaseFormProps) {
	const [formState, setFormState] = useState<PurchaseFormState>(() => buildInitialState(initialData, currentUserId));
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		setFormState(buildInitialState(initialData, currentUserId));
	}, [initialData, currentUserId]);

	const { contractAmount, totalAmount } = useMemo(() => {
		const contract = Number(formState.quantity) * Number(formState.unitPrice);
		const fee = Number(formState.feeAmount);
		const safeContract = Number.isFinite(contract) ? contract : 0;
		const safeFee = Number.isFinite(fee) ? Math.max(fee, 0) : 0;
		return {
			contractAmount: safeContract,
			totalAmount: safeContract + safeFee,
		};
	}, [formState.quantity, formState.unitPrice, formState.feeAmount]);

	const handleNumberChange = (field: 'quantity' | 'unitPrice' | 'feeAmount', value: string) => {
		const parsed = Number(value);
		setFormState((prev) => ({
			...prev,
			[field]: Number.isFinite(parsed) ? parsed : prev[field],
		}));
	};

	const handleProxyPaymentToggle = (checked: boolean) => {
		setFormState((prev) => ({
			...prev,
			isProxyPayment: checked,
		}));
	};

	const isSubmitting = submitting || disabled;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSubmitting) return;

		if (!formState.itemName.trim()) {
			toast.error('请填写物品名称');
			return;
		}
		if (!formState.purpose.trim()) {
			toast.error('请填写采购用途');
			return;
		}
		if (formState.quantity <= 0) {
			toast.error('数量必须大于 0');
			return;
		}
		if (formState.unitPrice <= 0) {
			toast.error('单价必须大于 0');
			return;
		}
		if (formState.feeAmount < 0) {
			toast.error('手续费不能为负数');
			return;
		}
		if (formState.purchaseChannel === 'offline' && !formState.purchaseLocation.trim()) {
			toast.error('线下采购需要填写采购地点');
			return;
		}
		if (formState.purchaseChannel === 'online' && !formState.purchaseLink.trim()) {
			toast.error('线上采购需要填写商品链接');
			return;
		}
		if (formState.hasProject && !formState.projectId.trim()) {
			toast.error('请选择需要关联的项目');
			return;
		}

		setSubmitting(true);
		try {
			const trimmedPaymentChannel = formState.paymentChannel.trim() || null;
			const trimmedPayer = formState.isProxyPayment ? formState.payerName.trim() || null : null;
			const trimmedTransactionNo = formState.transactionNo.trim() || null;
			const normalizedSupplierId = formState.supplierId.trim() || null;
			const effectiveInvoiceStatus =
				formState.invoiceType === FinanceInvoiceType.NONE
					? InvoiceStatus.NOT_REQUIRED
					: formState.invoiceStatus === InvoiceStatus.NOT_REQUIRED
						? InvoiceStatus.PENDING
						: formState.invoiceStatus;
			const invoiceNumber =
				effectiveInvoiceStatus === InvoiceStatus.ISSUED ? formState.invoiceNumber.trim() || null : null;
			const invoiceIssueDate =
				effectiveInvoiceStatus === InvoiceStatus.ISSUED && formState.invoiceIssueDate
					? toISODateString(formState.invoiceIssueDate)
					: null;

			const payload: PurchaseFormSubmitPayload = {
				purchaseDate: toISODateString(formState.purchaseDate),
				itemName: formState.itemName.trim(),
				specification: formState.specification.trim() || null,
				quantity: Number(formState.quantity),
				unitPrice: Number(formState.unitPrice),
				feeAmount: Number(formState.feeAmount) || 0,
				purchaseChannel: formState.purchaseChannel,
				purchaseLocation:
					formState.purchaseChannel === 'offline'
						? formState.purchaseLocation.trim() || null
						: null,
				purchaseLink:
					formState.purchaseChannel === 'online'
						? formState.purchaseLink.trim() || null
						: null,
				purpose: formState.purpose.trim(),
				paymentMethod: formState.paymentMethod,
				paymentType: formState.paymentType,
				paymentChannel: trimmedPaymentChannel,
				payerName: trimmedPayer,
				transactionNo: trimmedTransactionNo,
				purchaserId: formState.purchaserId,
				invoiceType: formState.invoiceType,
				invoiceStatus: effectiveInvoiceStatus,
				invoiceNumber,
				invoiceIssueDate,
				invoiceImages:
					formState.invoiceType === FinanceInvoiceType.NONE
						? []
						: formState.invoiceImages.filter(Boolean),
				receiptImages: formState.receiptImages.filter(Boolean),
				hasProject: formState.hasProject,
				projectId: formState.hasProject ? formState.projectId.trim() || null : null,
				notes: formState.notes.trim() || null,
				attachments: formState.attachments.filter(Boolean),
				supplierId: normalizedSupplierId,
			};

			await onSubmit(payload);
		} catch (error) {
			console.error('保存采购信息失败', error);
			toast.error(error instanceof Error ? error.message : '保存失败，请稍后再试');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className={SECTION_CARD_CLASS}>
				<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">基本信息</h3>
				<div className="mt-4 grid gap-6 lg:grid-cols-12">
					<div className="lg:col-span-6">
						<Label htmlFor="itemName" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							物品名称 <span className="text-rose-500">*</span>
						</Label>
						<Input
							id="itemName"
							value={formState.itemName}
							onChange={(event) => setFormState((prev) => ({ ...prev, itemName: event.target.value }))}
							placeholder="例如: MacBook Pro 14"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="lg:col-span-6">
						<Label htmlFor="purchaserId" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							申请人 <span className="text-rose-500">*</span>
						</Label>
						<UserSelect
							value={formState.purchaserId}
							onChange={(value) => setFormState((prev) => ({ ...prev, purchaserId: value }))}
							placeholder="选择申请人"
							disabled={isSubmitting}
						/>
					</div>
					<div className="lg:col-span-12">
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">关联供应商</Label>
						<SupplierSelector
							value={formState.supplierId}
							onChange={(supplierId) => setFormState((prev) => ({ ...prev, supplierId }))}
							disabled={isSubmitting}
							helperText="用于财务自动化和统计分析，默认展示状态正常的供应商"
						/>
					</div>
					<div className="lg:col-span-6">
						<DatePicker
							label="采购日期"
							required
							placeholder="选择采购日期"
							value={formState.purchaseDate}
							onChange={(value) => setFormState((prev) => ({ ...prev, purchaseDate: value }))}
							clearable={false}
							disabled={isSubmitting}
							containerClassName="w-full"
						/>
					</div>
					<div className="lg:col-span-6">
						<Label htmlFor="specification" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							规格 / 型号
						</Label>
						<Input
							id="specification"
							value={formState.specification}
							onChange={(event) => setFormState((prev) => ({ ...prev, specification: event.target.value }))}
							placeholder="可选，例如: M3 Pro / 36GB"
							disabled={isSubmitting}
						/>
					</div>
					<div className="lg:col-span-12">
						<div className="grid gap-4 md:grid-cols-3">
							<div>
								<Label htmlFor="quantity" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									数量 <span className="text-rose-500">*</span>
								</Label>
								<Input
									id="quantity"
									type="number"
									min={1}
									step={1}
									value={formState.quantity}
									onChange={(event) => handleNumberChange('quantity', event.target.value)}
									required
									disabled={isSubmitting}
								/>
							</div>
							<div>
								<Label htmlFor="unitPrice" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									单价 (元) <span className="text-rose-500">*</span>
								</Label>
								<Input
									id="unitPrice"
									type="number"
									min={0}
									step="0.01"
									value={formState.unitPrice}
									onChange={(event) => handleNumberChange('unitPrice', event.target.value)}
									required
									disabled={isSubmitting}
								/>
							</div>
							<div>
								<Label htmlFor="feeAmount" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									手续费 (元)
								</Label>
								<Input
									id="feeAmount"
									type="number"
									min={0}
									step="0.01"
									value={formState.feeAmount}
									onChange={(event) => handleNumberChange('feeAmount', event.target.value)}
									disabled={isSubmitting}
								/>
							</div>
						</div>
					</div>
					<div className="lg:col-span-12 grid gap-4 md:grid-cols-2">
						<div>
							<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">合同金额 (元)</Label>
							<div className="flex h-11 items-center rounded-xl bg-gray-50 px-4 text-sm font-semibold text-gray-900 shadow-inner dark:bg-gray-800/70 dark:text-gray-100">
								¥{contractAmount.toFixed(2)}
							</div>
						</div>
						<div>
							<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">总金额 (含手续费)</Label>
							<div className="flex h-11 items-center rounded-xl bg-gray-50 px-4 text-sm font-semibold text-gray-900 shadow-inner dark:bg-gray-800/70 dark:text-gray-100">
								¥{totalAmount.toFixed(2)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className={SECTION_CARD_CLASS}>
				<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">采购与付款信息</h3>
				<div className="mt-4 grid gap-6 lg:grid-cols-12">
					<div className="lg:col-span-4">
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							采购渠道 <span className="text-rose-500">*</span>
						</Label>
						<Select
							value={formState.purchaseChannel}
							onValueChange={(value: PurchaseChannel) =>
								setFormState((prev) => ({
									...prev,
									purchaseChannel: value,
								}))
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="选择采购渠道" />
							</SelectTrigger>
							<SelectContent>
								{PURCHASE_CHANNELS.map((channel) => (
									<SelectItem key={channel} value={channel}>
										{channelLabels[channel]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="lg:col-span-4">
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							款项类型 <span className="text-rose-500">*</span>
						</Label>
						<Select
							value={formState.paymentType}
							onValueChange={(value: PaymentType) =>
								setFormState((prev) => ({
									...prev,
									paymentType: value,
								}))
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="选择款项类型" />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{paymentTypeLabels[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="lg:col-span-4">
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							付款方式 <span className="text-rose-500">*</span>
						</Label>
						<Select
							value={formState.paymentMethod}
							onValueChange={(value: PaymentMethod) =>
								setFormState((prev) => ({
									...prev,
									paymentMethod: value,
								}))
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="选择付款方式" />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_METHODS.map((method) => (
									<SelectItem key={method} value={method}>
										{paymentLabels[method]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="lg:col-span-6">
						<Label htmlFor="paymentChannel" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							支付方式 / 通道
						</Label>
						<Input
							id="paymentChannel"
							value={formState.paymentChannel}
							onChange={(event) => setFormState((prev) => ({ ...prev, paymentChannel: event.target.value }))}
							placeholder="如：公对公 / 公对私"
							disabled={isSubmitting}
							list="payment-channel-options"
						/>
						<datalist id="payment-channel-options">
							{paymentChannelSuggestions.map((option) => (
								<option key={option} value={option} />
							))}
						</datalist>
					</div>
					<div className="lg:col-span-6">
						<Label htmlFor="transactionNo" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							流水号
						</Label>
						<Input
							id="transactionNo"
							value={formState.transactionNo}
							onChange={(event) => setFormState((prev) => ({ ...prev, transactionNo: event.target.value }))}
							placeholder="银行 / 支付平台流水号"
							disabled={isSubmitting}
						/>
					</div>
					<div className="lg:col-span-6">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<Label htmlFor="payerName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
								代付人
							</Label>
							<label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
								<span>由同事代付</span>
								<Switch checked={formState.isProxyPayment} onCheckedChange={handleProxyPaymentToggle} disabled={isSubmitting} />
							</label>
						</div>
						{formState.isProxyPayment ? (
							<Input
								id="payerName"
								value={formState.payerName}
								onChange={(event) => setFormState((prev) => ({ ...prev, payerName: event.target.value }))}
								placeholder="如有代付同事，可填写姓名"
								disabled={isSubmitting}
							/>
						) : (
							<div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500 shadow-inner dark:bg-gray-800/50 dark:text-gray-400">
								当前费用由本人支付，如有代付再打开开关填写姓名。
							</div>
						)}
					</div>
					<div className="lg:col-span-6">
						<div className="rounded-xl bg-blue-50 px-4 py-4 text-xs text-blue-700 shadow-sm dark:bg-blue-500/10 dark:text-blue-200">
							<p className="text-sm font-semibold">提示</p>
							<p className="mt-1 leading-relaxed">
								标记“已打款”后系统会自动通知申请人，并把该采购视为完成，可用于后续对账与归档。
							</p>
						</div>
					</div>
					<div className="lg:col-span-6">
						{formState.purchaseChannel === 'online' ? (
							<div>
								<Label htmlFor="purchaseLink" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									商品链接 <span className="text-rose-500">*</span>
								</Label>
								<Input
									id="purchaseLink"
									value={formState.purchaseLink}
									onChange={(event) => setFormState((prev) => ({ ...prev, purchaseLink: event.target.value }))}
									placeholder="例如：https://item.jd.com/..."
									required
									disabled={isSubmitting}
								/>
							</div>
						) : (
							<div>
								<Label htmlFor="purchaseLocation" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
									采购地点 <span className="text-rose-500">*</span>
								</Label>
								<Input
									id="purchaseLocation"
									value={formState.purchaseLocation}
									onChange={(event) =>
										setFormState((prev) => ({ ...prev, purchaseLocation: event.target.value }))
									}
									placeholder="例如：上海·徐家汇 Apple 授权店"
									required
									disabled={isSubmitting}
								/>
							</div>
						)}
					</div>
					<div className="lg:col-span-6">
						<Label htmlFor="purchasePurpose" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							采购用途 <span className="text-rose-500">*</span>
						</Label>
						<Textarea
							id="purchasePurpose"
							rows={4}
							value={formState.purpose}
							onChange={(event) => setFormState((prev) => ({ ...prev, purpose: event.target.value }))}
							required
							disabled={isSubmitting}
							placeholder="说明采购背景、预算归属或审批依据"
						/>
					</div>
				</div>
			</div>

			<div className={SECTION_CARD_CLASS}>
				<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">发票 / 凭证</h3>
				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">发票类型</Label>
						<Select
							value={formState.invoiceType}
							onValueChange={(value: PurchaseInvoiceType) =>
								setFormState((prev) => {
									const nextStatus =
										value === FinanceInvoiceType.NONE
											? InvoiceStatus.NOT_REQUIRED
											: prev.invoiceStatus === InvoiceStatus.NOT_REQUIRED
												? InvoiceStatus.PENDING
												: prev.invoiceStatus;
									const shouldClearIssuedFields = nextStatus !== InvoiceStatus.ISSUED;
									return {
										...prev,
										invoiceType: value,
										invoiceStatus: nextStatus,
										invoiceImages: value === FinanceInvoiceType.NONE ? [] : prev.invoiceImages,
										invoiceNumber: shouldClearIssuedFields ? '' : prev.invoiceNumber,
										invoiceIssueDate: shouldClearIssuedFields ? '' : prev.invoiceIssueDate,
									};
								})
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="选择发票类型" />
							</SelectTrigger>
							<SelectContent>
								{INVOICE_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{invoiceLabels[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">收据 / 打款凭证</Label>
						<FileUpload
							files={formState.receiptImages}
							onChange={(files) => setFormState((prev) => ({ ...prev, receiptImages: files }))}
							maxFiles={5}
							folder="purchases/receipts"
							prefix="receipt"
							buttonLabel="上传收据"
							uploadingLabel="上传中..."
							helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
							disabled={isSubmitting}
						/>
					</div>
				</div>

				{formState.invoiceType !== FinanceInvoiceType.NONE && (
					<>
						<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">开票状态</Label>
								<Select
									value={formState.invoiceStatus}
									onValueChange={(value: InvoiceStatus) =>
										setFormState((prev) => {
											const shouldClear = value !== InvoiceStatus.ISSUED;
											return {
												...prev,
												invoiceStatus: value,
												invoiceNumber: shouldClear ? '' : prev.invoiceNumber,
												invoiceIssueDate: shouldClear ? '' : prev.invoiceIssueDate,
											};
										})
									}
									disabled={isSubmitting}
								>
									<SelectTrigger>
										<SelectValue placeholder="选择开票状态" />
									</SelectTrigger>
									<SelectContent>
										{INVOICE_STATUSES.map((status) => (
											<SelectItem
												key={status}
												value={status}
												disabled={status === InvoiceStatus.NOT_REQUIRED && formState.invoiceType !== FinanceInvoiceType.NONE}
											>
												{invoiceStatusLabels[status]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{formState.invoiceStatus === InvoiceStatus.ISSUED && (
								<>
									<div>
										<Label htmlFor="invoiceNumber" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
											发票号码
										</Label>
										<Input
											id="invoiceNumber"
											value={formState.invoiceNumber}
											onChange={(event) => setFormState((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
											placeholder="请输入发票号码"
											disabled={isSubmitting}
										/>
									</div>
									<div>
										<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">开票日期</Label>
										<DatePicker
											value={formState.invoiceIssueDate}
											onChange={(value) =>
												setFormState((prev) => ({
													...prev,
													invoiceIssueDate: value,
												}))
											}
											disabled={isSubmitting}
										/>
									</div>
								</>
							)}
						</div>
						<div>
							<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">发票附件</Label>
							<FileUpload
								files={formState.invoiceImages}
								onChange={(files) => setFormState((prev) => ({ ...prev, invoiceImages: files }))}
								maxFiles={5}
								folder="purchases/invoices"
								prefix="invoice"
								buttonLabel="上传发票"
								helperText="如仍在申请发票，可暂不上传附件"
								disabled={isSubmitting}
							/>
						</div>
					</>
				)}
			</div>

			<div className={SECTION_CARD_CLASS}>
				<h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">项目与附件</h3>
				<div className="mt-4 space-y-4">
					<div className="flex items-center gap-3">
						<Switch
							id="hasProject"
							checked={formState.hasProject}
							onCheckedChange={(checked) =>
								setFormState((prev) => {
									const nextValue = Boolean(checked);
									return {
										...prev,
										hasProject: nextValue,
										projectId: nextValue ? prev.projectId : '',
									};
								})
							}
							disabled={isSubmitting}
						/>
						<Label htmlFor="hasProject" className="text-sm font-medium text-gray-700 dark:text-gray-300">
							关联项目预算
						</Label>
					</div>
					{formState.hasProject && (
						<div className="space-y-2">
							<Label className="block text-sm font-medium text-gray-700 dark:text-gray-300">关联项目</Label>
							<ProjectSelector
								value={formState.projectId}
								onChange={(projectId) =>
									setFormState((prev) => ({
										...prev,
										projectId,
									}))
								}
								disabled={isSubmitting}
								helperText="仅可选择自己参与或最近更新的项目，如需其他项目请联系管理员"
							/>
						</div>
					)}

					<div>
						<Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">附件</Label>
						<FileUpload
							files={formState.attachments}
							onChange={(files) => setFormState((prev) => ({ ...prev, attachments: files }))}
							maxFiles={8}
							folder="purchases/attachments"
							prefix="attachment"
							buttonLabel="上传附件"
							helperText="可上传合同、报价单、商务往来记录等辅助材料"
							disabled={isSubmitting}
						/>
					</div>
				</div>
			</div>

			<div className={SECTION_CARD_CLASS}>
				<Label htmlFor="purchaseNotes" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
					备注
				</Label>
				<Textarea
					id="purchaseNotes"
					rows={3}
					value={formState.notes}
					onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
					disabled={isSubmitting}
					placeholder="审批人需要知晓的补充说明"
				/>
			</div>

			<div className="flex justify-end gap-3">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="min-w-[100px]">
						取消
					</Button>
				)}
				<Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
					{isSubmitting ? '保存中...' : mode === 'create' ? '保存采购单' : '保存修改'}
				</Button>
			</div>
		</form>
	);
}
