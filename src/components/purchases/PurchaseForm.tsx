"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Info } from 'lucide-react';

import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import FileUpload from '@/components/common/FileUpload';
import UserSelect from '@/components/common/UserSelect';
import EmployeeSelector from '@/components/common/EmployeeSelector';
import ProjectSelector from '@/components/common/ProjectSelector';
import SupplierSelector from '@/components/common/SupplierSelector';
import { formatDateOnly } from '@/lib/dates';
import {
	INVOICE_TYPES,
	INVOICE_STATUSES,
	PAYMENT_METHODS,
	PAYMENT_TYPES,
	PURCHASE_CHANNELS,
	PURCHASE_ORGANIZATIONS,
	InvoiceStatus,
	InvoiceType,
	PaymentMethod,
	PaymentType,
	PurchaseChannel,
	PurchaseOrganization,
	type PurchaseRecord,
} from '@/types/purchase';
import { purchaseFormSchema, type PurchaseFormValues } from '@/lib/validations/purchase';

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

const invoiceLabels: Record<InvoiceType, string> = {
	[InvoiceType.SPECIAL]: '增值税专票',
	[InvoiceType.GENERAL]: '普通发票',
	[InvoiceType.NONE]: '无需发票',
};

const paymentChannelSuggestions = ['公对公', '公对私', '银行转账', '支付宝', '微信', '现金', '其他'];
const SECTION_CARD_CLASS = 'surface-panel p-6';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FIELD_FULL = 'w-full lg:col-span-1';
const organizationLabels: Record<PurchaseOrganization, string> = {
	school: '学校',
	company: '单位',
};
const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const toDateInputValue = (value?: string | null, fallbackToday = false): string => {
	if (!value) {
		return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
	}
	if (ISO_DATE_PATTERN.test(trimmed)) {
		return trimmed;
	}
	const [dateSegment] = trimmed.split('T');
	if (dateSegment && ISO_DATE_PATTERN.test(dateSegment)) {
		return dateSegment;
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return fallbackToday ? formatDateOnly(new Date()) ?? '' : '';
	}
	return formatDateOnly(parsed) ?? '';
};

export type PurchaseFormSubmitPayload = {
	purchaseDate: string;
	organizationType: PurchaseOrganization;
	itemName: string;
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
	supplierId: string | null;
	invoiceType: InvoiceType;
	invoiceStatus: InvoiceStatus;
	invoiceNumber: string | null;
	invoiceIssueDate: string | null;
	invoiceImages: string[];
	receiptImages: string[];
	hasProject: boolean;
	projectId: string | null;
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

export default function PurchaseForm({ mode, initialData, currentUserId, onSubmit, onCancel, disabled = false }: PurchaseFormProps) {
	const [proxyPayerUserId, setProxyPayerUserId] = useState('');
	const defaultValues = useMemo<PurchaseFormValues>(() => {
		const invoiceType = initialData?.invoiceType ?? InvoiceType.NONE;
		const invoiceStatus =
			initialData?.invoiceStatus ?? (invoiceType === InvoiceType.NONE ? InvoiceStatus.NOT_REQUIRED : InvoiceStatus.PENDING);
		return {
			purchaseDate: toDateInputValue(initialData?.purchaseDate, true),
			organizationType: initialData?.organizationType ?? 'company',
			itemName: initialData?.itemName ?? '',
			specification: initialData?.specification ?? '',
			quantity: initialData?.quantity ?? 1,
			unitPrice: initialData?.unitPrice ?? 0,
			feeAmount: initialData?.feeAmount ?? 0,
			purchaseChannel: initialData?.purchaseChannel ?? 'online',
			purchaseLocation: initialData?.purchaseLocation ?? '',
			purchaseLink: initialData?.purchaseLink ?? '',
			purpose: initialData?.purpose ?? '',
			paymentMethod: initialData?.paymentMethod ?? 'wechat',
			paymentType: initialData?.paymentType ?? PaymentType.FULL_PAYMENT,
			paymentChannel: initialData?.paymentChannel ?? '',
			isProxyPayment: Boolean(initialData?.payerName),
			payerName: initialData?.payerName ?? '',
			transactionNo: initialData?.transactionNo ?? '',
			purchaserId: currentUserId,
			supplierId: initialData?.supplierId ?? '',
			invoiceType,
			invoiceStatus,
			invoiceNumber: initialData?.invoiceNumber ?? '',
			invoiceIssueDate: toDateInputValue(initialData?.invoiceIssueDate ?? ''),
			invoiceImages: initialData?.invoiceImages ?? [],
			receiptImages: initialData?.receiptImages ?? [],
			hasProject: initialData?.hasProject ?? false,
			projectId: initialData?.projectId ?? '',
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
		setProxyPayerUserId('');
	}, [defaultValues, form]);

	useEffect(() => {
		form.setValue('purchaserId', currentUserId, { shouldDirty: false, shouldValidate: true });
	}, [currentUserId, form]);

	const values = form.watch();
	const isSubmitting = form.formState.isSubmitting || disabled;
	const contractAmount = Number(values.quantity || 0) * Number(values.unitPrice || 0);
	const totalAmount = contractAmount + Number(values.feeAmount || 0);
	const [budgetInfo, setBudgetInfo] = useState<{
		departmentName: string | null;
		budgetAmount: number | null;
		usedAmount: number;
		remainingAmount: number | null;
		year: number;
	} | null>(null);
	const [budgetLoading, setBudgetLoading] = useState(false);

	useEffect(() => {
		const purchaserId = values.purchaserId;
		if (!purchaserId) {
			setBudgetInfo(null);
			return;
		}
		let active = true;
		(async () => {
			setBudgetLoading(true);
			try {
				const year = new Date().getFullYear();
				const response = await fetch(`/api/hr/departments/budget?employeeId=${purchaserId}&year=${year}`);
				const payload = await response.json();
				if (!response.ok || !payload.success) {
					throw new Error(payload.error || '预算加载失败');
				}
				if (!active) return;
				setBudgetInfo(payload.data ?? null);
			} catch (error) {
				if (!active) return;
				setBudgetInfo(null);
			} finally {
				if (active) setBudgetLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, [values.purchaserId]);

	const handleSubmit = form.handleSubmit(async (data) => {
		try {
			const trimmedPaymentChannel = data.paymentChannel?.trim() || null;
			const trimmedTransactionNo = data.transactionNo?.trim() || null;
			const trimmedSupplierId = data.supplierId?.trim() || null;
			const effectiveInvoiceStatus =
				data.invoiceType === InvoiceType.NONE
					? InvoiceStatus.NOT_REQUIRED
					: data.invoiceStatus === InvoiceStatus.NOT_REQUIRED
						? InvoiceStatus.PENDING
						: data.invoiceStatus;
			const invoiceNumber =
				effectiveInvoiceStatus === InvoiceStatus.ISSUED ? data.invoiceNumber?.trim() || null : null;
			const invoiceIssueDate =
				effectiveInvoiceStatus === InvoiceStatus.ISSUED && data.invoiceIssueDate?.trim()
					? data.invoiceIssueDate.trim()
					: null;

			const payload: PurchaseFormSubmitPayload = {
				purchaseDate: data.purchaseDate?.trim() || formatDateOnly(new Date()) || '',
				organizationType: data.organizationType,
				itemName: data.itemName.trim(),
				specification: data.specification?.trim() || null,
				quantity: Number(data.quantity),
				unitPrice: Number(data.unitPrice),
				feeAmount: Number(data.feeAmount) || 0,
				purchaseChannel: data.purchaseChannel,
				purchaseLocation: data.purchaseChannel === 'offline' ? data.purchaseLocation?.trim() || null : null,
				purchaseLink: data.purchaseChannel === 'online' ? data.purchaseLink?.trim() || null : null,
				purpose: data.purpose.trim(),
				paymentMethod: data.paymentMethod,
				paymentType: data.paymentType,
				paymentChannel: trimmedPaymentChannel,
				payerName: data.isProxyPayment ? data.payerName?.trim() || null : null,
				transactionNo: trimmedTransactionNo,
				purchaserId: currentUserId,
				supplierId: trimmedSupplierId,
				invoiceType: data.invoiceType,
				invoiceStatus: effectiveInvoiceStatus,
				invoiceNumber,
				invoiceIssueDate,
				invoiceImages: data.invoiceType === InvoiceType.NONE ? [] : data.invoiceImages.filter(Boolean),
				receiptImages: data.receiptImages.filter(Boolean),
				hasProject: data.hasProject,
				projectId: data.hasProject ? data.projectId?.trim() || null : null,
				notes: data.notes?.trim() || null,
				attachments: data.attachments.filter(Boolean),
			};

			await onSubmit(payload);
		} catch (error) {
			console.error('保存采购信息失败', error);
			toast.error(error instanceof Error ? error.message : '保存失败，请稍后再试');
		}
	});

	const handlePurchaseChannelChange = (value: PurchaseChannel) => {
		if (value === 'online') {
			form.setValue('purchaseLocation', '', { shouldDirty: true, shouldValidate: true });
		} else {
			form.setValue('purchaseLink', '', { shouldDirty: true, shouldValidate: true });
		}
	};

	const handleProxyPaymentToggle = (checked: boolean) => {
		form.setValue('isProxyPayment', checked, { shouldDirty: true, shouldValidate: true });
		if (!checked) {
			setProxyPayerUserId('');
			form.setValue('payerName', '', { shouldDirty: true, shouldValidate: true });
		}
	};

	const handleInvoiceTypeChange = (value: InvoiceType) => {
		if (value === InvoiceType.NONE) {
			form.setValue('invoiceStatus', InvoiceStatus.NOT_REQUIRED, { shouldDirty: true, shouldValidate: true });
			form.setValue('invoiceImages', [], { shouldDirty: true });
			form.setValue('invoiceNumber', '', { shouldDirty: true, shouldValidate: true });
			form.setValue('invoiceIssueDate', '', { shouldDirty: true, shouldValidate: true });
		} else if (form.getValues('invoiceStatus') === InvoiceStatus.NOT_REQUIRED) {
			form.setValue('invoiceStatus', InvoiceStatus.PENDING, { shouldDirty: true, shouldValidate: true });
		}
	};

	const handleInvoiceStatusChange = (value: InvoiceStatus) => {
		if (value !== InvoiceStatus.ISSUED) {
			form.setValue('invoiceNumber', '', { shouldDirty: true, shouldValidate: true });
			form.setValue('invoiceIssueDate', '', { shouldDirty: true, shouldValidate: true });
		}
	};

	const handleProjectToggle = (checked: boolean) => {
		form.setValue('hasProject', checked, { shouldDirty: true, shouldValidate: true });
		if (!checked) {
			form.setValue('projectId', '', { shouldDirty: true, shouldValidate: true });
		}
	};

	const isOnlinePurchase = values.purchaseChannel === 'online';
	const isProxyPayment = values.isProxyPayment;
	const requiresInvoiceDetails = values.invoiceType !== InvoiceType.NONE;
	const showInvoiceIssuedFields = values.invoiceStatus === InvoiceStatus.ISSUED;
	const hasProject = values.hasProject;

	return (
		<Form {...form}>
			<form onSubmit={handleSubmit} className="flex min-h-[560px] max-h-[calc(100vh-170px)] flex-col gap-4">
				<div className="flex-1 space-y-6 overflow-y-auto pr-1">
				<div className={SECTION_CARD_CLASS}>
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-base font-semibold text-foreground">基本信息</h3>
						<p className="text-xs text-muted-foreground">填写采购基础信息与预算情况</p>
					</div>
					<div className="mt-4 grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
						<FormField
							control={form.control}
							name="itemName"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">
										物品名称 <span className="text-rose-500">*</span>
									</FormLabel>
									<FormControl>
										<Input placeholder="例如: MacBook Pro 14" disabled={isSubmitting} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="purchaserId"
							render={() => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">
										申请人 <span className="text-rose-500">*</span>
									</FormLabel>
									<FormControl>
										<UserSelect
											value={currentUserId}
											onChange={() => {}}
											placeholder="申请人固定为当前登录用户"
											disabled
										/>
									</FormControl>
									<p className="text-xs text-muted-foreground">申请人固定为当前登录用户，不可修改。</p>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="supplierId"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">关联供应商</FormLabel>
									<FormControl>
										<SupplierSelector
											value={field.value ?? ''}
											onChange={field.onChange}
											disabled={isSubmitting}
											helperText="用于财务自动化和统计分析，默认展示状态正常的供应商"
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
											<SelectTrigger className="h-11">
												<SelectValue placeholder="选择采购组织" />
											</SelectTrigger>
											<SelectContent>
												{PURCHASE_ORGANIZATIONS.map((org) => (
													<SelectItem key={org} value={org}>
														{organizationLabels[org]}
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
							name="specification"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">规格 / 型号</FormLabel>
									<FormControl>
										<Input placeholder="可选，例如: M3 Pro / 36GB" disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
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
										数量 <span className="text-rose-500">*</span>
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
										单价 (元) <span className="text-rose-500">*</span>
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
						<div className="w-full lg:col-span-1">
							<p className="mb-2 text-sm font-medium text-muted-foreground">合同金额 (元)</p>
							<div className="flex h-11 items-center rounded-xl bg-muted/50 px-4 text-sm font-semibold text-foreground">
								¥{contractAmount.toFixed(2)}
							</div>
						</div>
						<div className="w-full lg:col-span-1">
							<p className="mb-2 text-sm font-medium text-muted-foreground">总金额 (含手续费)</p>
							<div className="flex h-11 items-center rounded-xl bg-muted/50 px-4 text-sm font-semibold text-foreground">
								¥{totalAmount.toFixed(2)}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:col-span-3">
							<span className="font-medium text-foreground">部门预算</span>
							{budgetLoading ? (
								<span>正在加载预算...</span>
							) : budgetInfo?.budgetAmount != null ? (
								<span>
									{budgetInfo.departmentName ?? '未命名部门'} · {budgetInfo.year} 年度
								</span>
							) : (
								<span>未配置部门预算</span>
							)}
							{budgetInfo?.budgetAmount != null ? (
								<Popover>
									<PopoverTrigger asChild>
										<button
											type="button"
											className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground hover:text-foreground"
										>
											<Info className="h-4 w-4" />
										</button>
									</PopoverTrigger>
									<PopoverContent align="start" className="w-72">
										<div className="space-y-3 text-xs">
											<div className="flex items-center justify-between text-sm font-semibold text-foreground">
												<span>预算概览</span>
												<span>{budgetInfo.year} 年</span>
											</div>
											<div className="grid gap-2">
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">年度预算</span>
													<span className="font-semibold text-foreground">
														{currencyFormatter.format(budgetInfo.budgetAmount)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">已用预算</span>
													<span className="font-semibold text-foreground">
														{currencyFormatter.format(budgetInfo.usedAmount)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">剩余额度</span>
													<span
														className={`font-semibold ${
															totalAmount > (budgetInfo.remainingAmount ?? 0)
																? 'text-rose-600 dark:text-rose-300'
																: 'text-foreground'
														}`}
													>
														{currencyFormatter.format(budgetInfo.remainingAmount ?? 0)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">本次采购</span>
													<span className="font-semibold text-foreground">
														{currencyFormatter.format(totalAmount)}
													</span>
												</div>
											</div>
											{totalAmount > (budgetInfo.remainingAmount ?? 0) ? (
												<p className="rounded-lg bg-rose-50 px-2 py-1 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
													本次金额已超出剩余额度
												</p>
											) : null}
										</div>
									</PopoverContent>
								</Popover>
							) : null}
						{budgetInfo?.budgetAmount == null ? (
							<span className="text-muted-foreground">
								当前采购金额：{currencyFormatter.format(totalAmount)}
							</span>
						) : null}
					</div>
				</div>
				</div>

				<div className={SECTION_CARD_CLASS}>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<h3 className="text-base font-semibold text-foreground">采购与付款</h3>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground hover:text-foreground"
									>
										<Info className="h-4 w-4" />
									</button>
								</TooltipTrigger>
								<TooltipContent side="top" sideOffset={8} className="max-w-xs text-xs leading-relaxed">
									标记“已打款”后系统会自动通知申请人，并将采购视为完成，可用于后续对账与归档。
								</TooltipContent>
							</Tooltip>
						</div>
						<p className="text-xs text-muted-foreground">渠道、付款与用途信息</p>
					</div>
					<div className="mt-4 grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
						<FormField
							control={form.control}
							name="purchaseChannel"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">
										采购渠道 <span className="text-rose-500">*</span>
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
													{channelLabels[channel]}
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
							name="paymentType"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">
										款项类型 <span className="text-rose-500">*</span>
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
													{paymentTypeLabels[type]}
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
										付款方式 <span className="text-rose-500">*</span>
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
													{paymentLabels[method]}
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
							name="paymentChannel"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">支付方式 / 通道</FormLabel>
									<FormControl>
										<Input placeholder="如：公对公 / 公对私" disabled={isSubmitting} list="payment-channel-options" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
									</FormControl>
									<FormMessage />
									<datalist id="payment-channel-options">
										{paymentChannelSuggestions.map((option) => (
											<option key={option} value={option} />
										))}
									</datalist>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="transactionNo"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">流水号</FormLabel>
									<FormControl>
										<Input placeholder="银行 / 支付平台流水号" disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="space-y-2 lg:col-span-1">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm font-medium text-foreground">代付人</span>
								<label className="flex items-center gap-2 text-xs text-muted-foreground" htmlFor="proxy-switch">
									<span>由同事代付</span>
									<Switch id="proxy-switch" checked={isProxyPayment} onCheckedChange={handleProxyPaymentToggle} disabled={isSubmitting} />
								</label>
							</div>
							{isProxyPayment ? (
								<FormField
									control={form.control}
									name="payerName"
									render={({ field }) => (
										<FormItem className={FIELD_FULL}>
											<FormControl>
												<EmployeeSelector
													value={proxyPayerUserId}
													onChange={(userId, employee) => {
														setProxyPayerUserId(userId);
														const displayName =
															employee?.displayName?.trim() ||
															`${employee?.lastName ?? ''}${employee?.firstName ?? ''}`.trim() ||
															employee?.email ||
															'';
														field.onChange(displayName);
													}}
													disabled={isSubmitting}
													helperText="请选择代付同事，系统将记录为代付人。"
												/>
											</FormControl>
											{field.value && !proxyPayerUserId ? (
												<p className="text-xs text-muted-foreground">当前记录：{field.value}</p>
											) : null}
											<FormMessage />
										</FormItem>
									)}
								/>
							) : (
								<div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
									当前费用由本人支付，如有代付再打开开关填写姓名。
								</div>
							)}
						</div>
						{isOnlinePurchase ? (
							<FormField
								control={form.control}
								name="purchaseLink"
								render={({ field }) => (
									<FormItem className={FIELD_FULL}>
										<FormLabel className="text-sm font-medium text-foreground">
											商品链接 <span className="text-rose-500">*</span>
										</FormLabel>
										<FormControl>
											<Input placeholder="例如：https://item.jd.com/..." disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						) : (
							<FormField
								control={form.control}
								name="purchaseLocation"
								render={({ field }) => (
									<FormItem className={FIELD_FULL}>
										<FormLabel className="text-sm font-medium text-foreground">
											采购地点 <span className="text-rose-500">*</span>
										</FormLabel>
										<FormControl>
											<Input placeholder="例如：上海·徐家汇 Apple 授权店" disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
							<FormField
								control={form.control}
								name="purpose"
								render={({ field }) => (
									<FormItem className={`${FIELD_FULL} lg:col-span-4`}>
										<FormLabel className="text-sm font-medium text-foreground">
											采购用途 <span className="text-rose-500">*</span>
										</FormLabel>
										<FormControl>
											<Textarea rows={2} placeholder="说明采购背景、预算归属或审批依据" disabled={isSubmitting} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
					</div>
				</div>

				<div className={SECTION_CARD_CLASS}>
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-base font-semibold text-foreground">
							发票 / 凭证
							<span className="ml-2 text-xs font-normal text-muted-foreground">（如无需发票可直接跳过）</span>
						</h3>
					</div>
					<div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
						<FormField
							control={form.control}
							name="invoiceType"
							render={({ field }) => (
								<FormItem className={FIELD_FULL}>
									<FormLabel className="text-sm font-medium text-foreground">发票类型</FormLabel>
									<Select
										value={field.value}
										onValueChange={(value: InvoiceType) => {
											field.onChange(value);
											handleInvoiceTypeChange(value);
										}}
										disabled={isSubmitting}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="选择发票类型" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{INVOICE_TYPES.map((type) => (
												<SelectItem key={type} value={type}>
													{invoiceLabels[type]}
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
							name="receiptImages"
							render={({ field }) => (
								<FormItem className={`${FIELD_FULL} lg:col-span-3`}>
									<FormLabel className="text-sm font-medium text-foreground">收据 / 打款凭证</FormLabel>
									<FormControl>
										<FileUpload
											files={field.value || []}
											onChange={field.onChange}
											maxFiles={5}
											folder="purchases/receipts"
											prefix="receipt"
											buttonLabel="上传收据"
											uploadingLabel="上传中..."
											helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
											disabled={isSubmitting}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					{requiresInvoiceDetails && (
						<div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
							<FormField
								control={form.control}
								name="invoiceStatus"
								render={({ field }) => (
									<FormItem className={FIELD_FULL}>
										<FormLabel className="text-sm font-medium text-foreground">开票状态</FormLabel>
										<Select
											value={field.value}
											onValueChange={(value: InvoiceStatus) => {
												field.onChange(value);
												handleInvoiceStatusChange(value);
											}}
											disabled={isSubmitting}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="选择开票状态" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{INVOICE_STATUSES.map((status) => (
													<SelectItem
														key={status}
														value={status}
														disabled={status === InvoiceStatus.NOT_REQUIRED && values.invoiceType !== InvoiceType.NONE}
													>
														{invoiceStatusLabels[status]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							{showInvoiceIssuedFields && (
								<>
									<FormField
										control={form.control}
										name="invoiceNumber"
										render={({ field }) => (
											<FormItem className={FIELD_FULL}>
												<FormLabel className="text-sm font-medium text-foreground">发票号码</FormLabel>
												<FormControl>
														<Input placeholder="请输入发票号码" disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="invoiceIssueDate"
										render={({ field }) => (
											<FormItem className={FIELD_FULL}>
												<FormLabel className="text-sm font-medium text-foreground">开票日期</FormLabel>
												<FormControl>
													<DatePicker
														value={field.value}
														onChange={field.onChange}
														disabled={isSubmitting}
														containerClassName="w-full"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</>
							)}
							<FormField
								control={form.control}
								name="invoiceImages"
								render={({ field }) => (
									<FormItem className={`${FIELD_FULL} lg:col-span-3`}>
										<FormLabel className="text-sm font-medium text-foreground">发票附件</FormLabel>
										<FormControl>
											<FileUpload
												files={field.value || []}
												onChange={field.onChange}
												maxFiles={5}
												folder="purchases/invoices"
												prefix="invoice"
												buttonLabel="上传发票"
												helperText="如仍在申请发票，可暂不上传附件"
												disabled={isSubmitting}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					)}
				</div>

				<div className={SECTION_CARD_CLASS}>
					<div className="flex items-center justify-between gap-3">
						<h3 className="text-base font-semibold text-foreground">项目与附件</h3>
						<p className="text-xs text-muted-foreground">可选项，用于后续归档</p>
					</div>
					<div className="mt-4 grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
						<div className="flex items-center gap-3 lg:col-span-2">
							<Switch id="hasProject" checked={hasProject} onCheckedChange={handleProjectToggle} disabled={isSubmitting} />
							<label htmlFor="hasProject" className="text-sm font-medium text-foreground">
								关联项目预算
							</label>
						</div>
						{hasProject && (
							<FormField
								control={form.control}
								name="projectId"
								render={({ field }) => (
									<FormItem className={`${FIELD_FULL} lg:col-span-2`}>
										<FormLabel className="text-sm font-medium text-foreground">关联项目</FormLabel>
										<FormControl>
											<ProjectSelector
												value={field.value ?? ''}
												onChange={field.onChange}
												disabled={isSubmitting}
												helperText="仅可选择自己参与或最近更新的项目，如需其他项目请联系管理员"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<FormField
							control={form.control}
							name="attachments"
							render={({ field }) => (
								<FormItem className={`${FIELD_FULL} lg:col-span-3`}>
									<FormLabel className="text-sm font-medium text-foreground">附件</FormLabel>
									<FormControl>
										<FileUpload
											files={field.value || []}
											onChange={field.onChange}
											maxFiles={8}
											folder="purchases/attachments"
											prefix="attachment"
											buttonLabel="上传附件"
											helperText="可上传合同、报价单、商务往来记录等辅助材料"
											disabled={isSubmitting}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className={SECTION_CARD_CLASS}>
					<div className="grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
						<FormField
							control={form.control}
							name="notes"
							render={({ field }) => (
								<FormItem className={`${FIELD_FULL} lg:col-span-3`}>
									<FormLabel className="text-sm font-medium text-foreground">备注</FormLabel>
									<FormControl>
									<Textarea rows={3} placeholder="审批人需要知晓的补充说明" disabled={isSubmitting} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
				</div>

				<div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-border/60 bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
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
		</Form>
	);
}
