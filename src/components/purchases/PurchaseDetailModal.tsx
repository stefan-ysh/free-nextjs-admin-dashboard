'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Receipt, CreditCard, Building2, User, ArrowRight, Clock } from 'lucide-react';

import ModalShell from '@/components/common/ModalShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import PurchaseApprovalFlow from './PurchaseApprovalFlow';
import type { PurchaseRowPermissions } from './PurchaseTable';
import { getReimbursementStatusText } from '@/types/purchase';
import type { PurchaseDetail, PurchaseRecord } from '@/types/purchase';

type PurchaseDetailModalProps = {
	purchase: PurchaseDetail | null;
	onClose: () => void;
	permissions?: PurchaseRowPermissions;
	busy?: boolean;
	detailLoading?: boolean;
	detailError?: string | null;
	onReloadDetail?: () => void;
	onSubmit?: (purchase: PurchaseRecord) => void;
	onWithdraw?: (purchase: PurchaseRecord) => void;
	onApprove?: (purchase: PurchaseRecord) => void;
	onTransfer?: (purchase: PurchaseRecord) => void;
	onReject?: (purchase: PurchaseRecord) => void;
	onPay?: (purchase: PurchaseRecord) => void;
	onSubmitReimbursement?: (purchase: PurchaseRecord) => void;
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const dateDisplayFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

const dateTimeDisplayFormatter = new Intl.DateTimeFormat('zh-CN', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
});

// -- Labels & Helpers --

const CHANNEL_LABELS: Record<PurchaseDetail['purchaseChannel'], string> = {
	online: '线上',
	offline: '线下',
};

const ORGANIZATION_LABELS: Record<PurchaseDetail['organizationType'], string> = {
	school: '学校',
	company: '单位',
};

const PAYMENT_LABELS: Record<PurchaseDetail['paymentMethod'], string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};



const INVOICE_TYPE_LABELS: Record<PurchaseDetail['invoiceType'], string> = {
	special: '增值税专票',
	general: '普通发票',
	none: '无需发票',
};

const INVOICE_STATUS_LABELS: Record<PurchaseDetail['invoiceStatus'], string> = {
	issued: '已开票',
	pending: '待开票',
	not_required: '无需开票',
};

function parseDateValue(value: string | null): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const isoLike = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
	const parsed = new Date(isoLike);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		const fallback = new Date(`${trimmed}T00:00:00`);
		if (!Number.isNaN(fallback.getTime())) {
			return fallback;
		}
	}
	return null;
}

function formatDate(value: string | null): string {
	const date = parseDateValue(value);
	if (!date) return value ?? '—';
	return dateDisplayFormatter.format(date);
}

function formatDateTime(value: string | null): string {
	const date = parseDateValue(value);
	if (!date) return value ?? '—';
	return dateTimeDisplayFormatter.format(date);
}



function resolvePurchaser(purchase: PurchaseDetail): string {
	return purchase.purchaser.displayName || '未知用户';
}

// -- Components --

type InfoRow = { label: string; value: ReactNode; icon?: ReactNode };

function InfoCard({ title, rows, className }: { title: string; rows: InfoRow[]; className?: string }) {
	return (
		<div className={cn("overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md", className)}>
			<div className="border-b bg-muted/30 px-4 py-3">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
			</div>
			<div className="divide-y">
				{rows.map((row, idx) => (
					<div key={idx} className="flex h-12 items-center justify-between px-4 text-sm">
						<span className="flex items-center gap-2 text-muted-foreground">
							{row.icon && <span className="text-muted-foreground/70">{row.icon}</span>}
							{row.label}
						</span>
						<span className="truncate font-medium text-foreground text-right pl-4">{row.value}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function AttachmentCard({ url, type }: { url: string; type: 'file' | 'image' }) {
    const isImage = type === 'image' || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const fileName = url.split('/').pop() || '未命名文件';

    return (
        <a href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border bg-background transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md">
            {isImage ? (
                <div className="aspect-[4/3] w-full bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={fileName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
            ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/20 text-muted-foreground">
                    <FileText className="h-10 w-10 transition-colors group-hover:text-primary" />
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-background/90 p-2 backdrop-blur-sm">
                <p className="truncate text-xs font-medium text-foreground">{fileName}</p>
            </div>
        </a>
    );
}

// -- Main Component --

export default function PurchaseDetailModal({
	purchase,
	onClose,
	permissions,
	busy,
	onSubmit,
	onWithdraw,
	onApprove,
	onTransfer,
	onReject,
	onPay,
	onSubmitReimbursement,
	detailLoading,
	detailError,
	onReloadDetail,
}: PurchaseDetailModalProps) {
	const defaultTab: 'overview' | 'workflow' | 'finance' = 'workflow';
	const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'finance'>(defaultTab);

	useEffect(() => {
		setActiveTab(defaultTab);
	}, [defaultTab, purchase?.id]);

	if (!purchase) return null;

	const formattedAmount = currencyFormatter.format(purchase.totalAmount);
	const formattedFee = currencyFormatter.format(purchase.feeAmount ?? 0);
	const totalCost = currencyFormatter.format(purchase.totalAmount + (purchase.feeAmount ?? 0));

	// Action Button Logic
	const actions = [
		{ key: 'submit', label: '提交审批', visible: Boolean(permissions?.canSubmit), variant: 'default' as const, handler: () => onSubmit?.(purchase) },
		{ key: 'withdraw', label: '撤回申请', visible: Boolean(permissions?.canWithdraw), variant: 'outline' as const, handler: () => onWithdraw?.(purchase) },
		{ key: 'approve', label: '审批通过', visible: Boolean(permissions?.canApprove), variant: 'default' as const, handler: () => onApprove?.(purchase) },
		{ key: 'transfer', label: '转审', visible: Boolean(permissions?.canTransfer), variant: 'outline' as const, handler: () => onTransfer?.(purchase) },
		{ key: 'reject', label: '驳回申请', visible: Boolean(permissions?.canReject), variant: 'destructive' as const, handler: () => onReject?.(purchase) },
		{ key: 'pay', label: '标记打款', visible: Boolean(permissions?.canPay), variant: 'default' as const, handler: () => onPay?.(purchase) },
		{ key: 'submitReimbursement', label: '提交报销', visible: Boolean(permissions?.canSubmitReimbursement), variant: 'secondary' as const, handler: () => onSubmitReimbursement?.(purchase) },
	].filter((action) => action.visible);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[95vh] overflow-hidden p-0 sm:max-w-5xl border-0 shadow-2xl">
				<ModalShell
					title="采购详情"
					className="max-h-[95vh] bg-background"
					bodyClassName="p-0"
					footer={
						<DialogFooter className="gap-2 border-t bg-background/50 px-6 py-4 backdrop-blur-sm sm:justify-end">
							<Button variant="ghost" onClick={onClose} className="hover:bg-muted">关闭</Button>
							{actions.map((action) => (
								<Button key={action.key} variant={action.variant} onClick={action.handler} disabled={busy} className="shadow-sm">
									{action.label}
								</Button>
							))}
						</DialogFooter>
					}
				>
                    {/* Status & Alerts */}
                    <AnimatePresence>
                        {(detailLoading || detailError) && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }} 
                                animate={{ height: 'auto', opacity: 1 }} 
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 pt-4"
                            >
                                {detailLoading && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">正在同步最新审批状态...</div>}
                                {detailError && (
                                    <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                                        <span>{detailError}</span>
                                        {onReloadDetail && <Button variant="outline" size="sm" onClick={onReloadDetail} className="h-7 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:bg-transparent dark:hover:bg-red-900/40">重试</Button>}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-6 p-6">
                        
                        {/* Key Info Grid */}
                        <div className="grid gap-4 sm:grid-cols-3">
                            <InfoCard 
                                title="申请信息" 
                                rows={[
                                    { label: "申请人", value: resolvePurchaser(purchase), icon: <User className="h-3.5 w-3.5" /> },
                                    { label: "申请时间", value: purchase.createdAt ? formatDateTime(purchase.createdAt) : '—', icon: <Clock className="h-3.5 w-3.5" /> }
                                ]}
                            />
                            <InfoCard 
                                title="采购详情" 
                                rows={[
                                    { label: "类型", value: ORGANIZATION_LABELS[purchase.organizationType], icon: <Building2 className="h-3.5 w-3.5" /> },
                                    { label: "渠道", value: CHANNEL_LABELS[purchase.purchaseChannel], icon: <ArrowRight className="h-3.5 w-3.5" /> }
                                ]}
                            />
                            <InfoCard 
                                title="财务摘要" 
                                rows={[
                                    { label: "总成本", value: <span className="text-lg font-semibold text-primary">{formattedAmount}</span>, icon: <Receipt className="h-3.5 w-3.5" /> },
                                    { label: "支付方式", value: PAYMENT_LABELS[purchase.paymentMethod], icon: <CreditCard className="h-3.5 w-3.5" /> }
                                ]}
                            />
                        </div>

                        {/* Tabs Navigation */}
    					<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
    						<TabsList className="bg-muted/50 p-1">
                                <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <FileText className="h-4 w-4" /> 概览 & 凭证
                                </TabsTrigger>
    							<TabsTrigger value="workflow" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <Clock className="h-4 w-4" /> 流程进度
                                </TabsTrigger>
    							<TabsTrigger value="finance" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                    <Receipt className="h-4 w-4" /> 资金详情
                                </TabsTrigger>
    						</TabsList>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
        							<TabsContent value="overview" className="mt-0 space-y-6">
                                        
                                        {/* Specification & Notes */}
        								<div className="grid gap-6 md:grid-cols-3">
                                            <div className="col-span-2 space-y-6">
                                                <section>
                                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                                        <FileText className="h-4 w-4 text-primary" /> 规格与用途
                                                    </h3>
                                                    <div className="rounded-xl border bg-card p-4 text-sm text-foreground/80 shadow-sm">
                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                             <div>
                                                                <span className="block text-xs text-muted-foreground">规格型号</span>
                                                                <span className="font-medium">{purchase.specification ?? '—'}</span>
                                                             </div>
                                                             <div>
                                                                <span className="block text-xs text-muted-foreground">采购用途</span>
                                                                <span className="font-medium">{purchase.purpose}</span>
                                                             </div>
                                                        </div>
                                                        {purchase.notes && (
                                                            <div className="mt-4 border-t pt-3">
                                                                <span className="block text-xs text-muted-foreground">备注说明</span>
                                                                <p className="mt-1 leading-relaxed">{purchase.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>

                                                {/* Attachments Gallery */}
                                                <section>
                                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                                        <Receipt className="h-4 w-4 text-primary" /> 凭证画廊
                                                    </h3>
                                                    {['attachments', 'invoiceImages', 'receiptImages'].some(key => (purchase as any)[key]?.length) ? (
                                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                                            {purchase.attachments?.map((url, i) => <AttachmentCard key={`att-${i}`} url={url} type="file" />)}
                                                            {purchase.invoiceImages?.map((url, i) => <AttachmentCard key={`inv-${i}`} url={url} type="image" />)}
                                                            {purchase.receiptImages?.map((url, i) => <AttachmentCard key={`rec-${i}`} url={url} type="image" />)}
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
                                                            暂无上传凭证
                                                        </div>
                                                    )}
                                                </section>
                                            </div>

                                            <div className="space-y-6">
                                                 <section>
                                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                                                        <CreditCard className="h-4 w-4 text-primary" /> 发票信息
                                                    </h3>
                                                    <div className="space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">发票类型</span>
                                                            <span className="font-medium">{INVOICE_TYPE_LABELS[purchase.invoiceType]}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">发票状态</span>
                                                            <span className="font-medium">{INVOICE_STATUS_LABELS[purchase.invoiceStatus]}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">发票号码</span>
                                                            <span className="font-medium">{purchase.invoiceNumber ?? '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">开票日期</span>
                                                            <span className="font-medium">{formatDate(purchase.invoiceIssueDate)}</span>
                                                        </div>
                                                    </div>
                                                 </section>
                                            </div>
                                        </div>
        							</TabsContent>
        
        							<TabsContent value="workflow" className="mt-0">
                                        <div className="rounded-xl border bg-card p-6 shadow-sm">
            								<PurchaseApprovalFlow purchase={purchase} />
                                        </div>
        							</TabsContent>
        
        							<TabsContent value="finance" className="mt-0 space-y-6">
                                        <div className="grid gap-6 md:grid-cols-2">
                                            <section>
                                                <h3 className="mb-3 text-sm font-semibold text-foreground">资金明细</h3>
                                                 <div className="space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">合同金额</span>
                                                        <span className="font-medium">{formattedAmount}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">手续费</span>
                                                        <span className="font-medium text-amber-600">{formattedFee}</span>
                                                    </div>
                                                    <div className="border-t pt-3 flex justify-between">
                                                        <span className="font-medium text-foreground">总计支出</span>
                                                        <span className="font-bold text-lg text-primary">{totalCost}</span>
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="mb-3 text-sm font-semibold text-foreground">结算状态</h3>
                                                 <div className="space-y-3 rounded-xl border bg-card p-4 text-sm shadow-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">报销状态</span>
                                                        <span className="font-medium">{getReimbursementStatusText(purchase.reimbursementStatus)}</span>
                                                    </div>
                                                     <div className="flex justify-between">
                                                        <span className="text-muted-foreground">已打款</span>
                                                        <span className="font-medium text-emerald-600">{currencyFormatter.format(purchase.paidAmount ?? 0)}</span>
                                                    </div>
                                                     <div className="flex justify-between">
                                                        <span className="text-muted-foreground">待打款</span>
                                                        <span className="font-medium text-rose-600">{currencyFormatter.format(purchase.remainingAmount ?? 0)}</span>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>

                                        <section>
                                            <h3 className="mb-3 text-sm font-semibold text-foreground">打款记录</h3>
        									{purchase.payments.length ? (
        										<div className="space-y-3">
        											{purchase.payments.map((payment, index) => (
        												<div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/60 px-4 py-3 text-sm shadow-sm transition hover:bg-card">
        													<div className="flex items-center gap-3">
                                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                    <span className="text-xs font-bold">{index + 1}</span>
                                                                </div>
        														<div>
        															<p className="font-bold text-foreground">{currencyFormatter.format(payment.amount)}</p>
                                                                    <p className="text-xs text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
        														</div>
        													</div>
        													<div className="text-right">
        														<p className="text-foreground">{payment.payer?.displayName ?? '未知用户'}</p>
                                                                {payment.note && <p className="text-xs text-muted-foreground max-w-[200px] truncate">{payment.note}</p>}
        													</div>
        												</div>
        											))}
        										</div>
        									) : (
        										<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">暂无打款记录</div>
        									)}
        								</section>
        							</TabsContent>
                                </motion.div>
                            </AnimatePresence>
    					</Tabs>
                    </div>
				</ModalShell>
			</DialogContent>
		</Dialog>
	);
}
