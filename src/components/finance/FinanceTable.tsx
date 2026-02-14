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
import FilePreviewDialog from '@/components/common/FilePreviewDialog';
import { useState } from 'react';

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
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewFile, setPreviewFile] = useState<string | null>(null);
	const [previewLabel, setPreviewLabel] = useState<string>('');

	const handlePreview = (file: string, name: string) => {
		setPreviewFile(file);
		setPreviewLabel(name);
		setPreviewOpen(true);
	};

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
		<div className="surface-table flex-1 min-h-0 flex flex-col">
			<div className="md:hidden">
				<div className="space-y-3 p-4">
					{records.map((record) => {
						const totalAmount = record.contractAmount + record.fee;
						const invoiceStatus =
							record.invoice?.status && record.invoice.status !== InvoiceStatus.NOT_REQUIRED
								? getInvoiceStatusLabel(record.invoice.status)
								: '—';
						return (
							<div key={record.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-sm font-semibold text-foreground">{record.name}</div>
										<div className="mt-1 text-xs text-muted-foreground">{formatDate(record.date)}</div>
									</div>
								<Badge
									variant={record.type === TransactionType.INCOME ? 'default' : 'destructive'}
									className={record.type === TransactionType.INCOME ? 'bg-chart-5 text-primary-foreground hover:bg-chart-5/90' : ''}
								>
										{record.type === TransactionType.INCOME ? '收入' : '支出'}
									</Badge>
								</div>
								<div className="mt-3 grid gap-2 text-xs text-muted-foreground">
									<div className="flex items-center justify-between gap-3">
										<span>分类</span>
										<span className="text-foreground">{record.category}</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>金额</span>
										<span className={record.type === TransactionType.INCOME ? 'text-chart-5' : 'text-destructive'}>
											¥{totalAmount.toFixed(2)}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>支付方式</span>
										<span className="text-foreground">
											{record.paymentChannel || '-'} · {getPaymentTypeLabel(record.paymentType)}
										</span>
									</div>
									<div className="flex items-center justify-between gap-3">
										<span>发票状态</span>
										<span className="text-foreground">{invoiceStatus}</span>
									</div>
								</div>
								{canEdit || canDelete ? (
									<div className="mt-4 flex justify-end gap-2">
										{canEdit && (
											<Button size="sm" variant="outline" onClick={() => onEdit(record)}>
												编辑
											</Button>
										)}
										{canDelete && (
											<Button size="sm" variant="ghost" onClick={() => handleDelete(record)} className="text-destructive">
												删除
											</Button>
										)}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
			<div className="hidden md:flex md:flex-col flex-1 min-h-0">
				<Table
					stickyHeader
					scrollAreaClassName="max-h-[calc(100vh-350px)] custom-scrollbar"
					className="w-full text-sm text-muted-foreground [&_tbody_tr]:hover:bg-muted/40"
				>
					<TableHeader className="[&_tr]:border-b border-border/40">
						<TableRow className="bg-muted/40">
							<TableHead className="px-4 py-3 text-left">日期</TableHead>
							<TableHead className="px-4 py-3 text-left">名称</TableHead>
							<TableHead className="px-4 py-3 text-left">类型</TableHead>
							<TableHead className="px-4 py-3 text-left">分类</TableHead>
							<TableHead className="px-4 py-3 text-left">金额</TableHead>
							<TableHead className="px-4 py-3 text-left">支付方式</TableHead>
							<TableHead className="px-4 py-3 text-left">发票状态</TableHead>
							<TableHead className="px-4 py-3 text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="[&_tr]:border-0">
						{records.map((record) => {
							const totalAmount = record.contractAmount + record.fee;
							return (
								<TableRow key={record.id}>
									<TableCell className="px-4 py-3 text-muted-foreground">
										{formatDate(record.date)}
									</TableCell>
									<TableCell className="px-4 py-3 font-medium text-foreground">
										<span className="block max-w-[220px] truncate" title={record.name}>
											{record.name}
										</span>
									</TableCell>
									<TableCell className="px-4 py-3">
										<Badge
											variant={record.type === TransactionType.INCOME ? 'default' : 'destructive'}
											className={record.type === TransactionType.INCOME ? 'bg-chart-5 text-primary-foreground hover:bg-chart-5/90' : ''}
										>
											{record.type === TransactionType.INCOME ? '收入' : '支出'}
										</Badge>
									</TableCell>
									<TableCell className="px-4 py-3 text-sm text-muted-foreground">
										{record.category}
									</TableCell>
									<TableCell
										className={`px-4 py-3 font-semibold ${record.type === TransactionType.INCOME ? 'text-chart-5' : 'text-destructive'}`}
									>
										¥{totalAmount.toFixed(2)}
									</TableCell>
									<TableCell className="px-4 py-3 text-sm text-muted-foreground">
										<span className="block max-w-[180px] truncate" title={`${record.paymentChannel || '-'} · ${getPaymentTypeLabel(record.paymentType)}`}>
											{record.paymentChannel || '-'} · {getPaymentTypeLabel(record.paymentType)}
										</span>
									</TableCell>
									<TableCell className="px-4 py-3">
										{record.invoice?.status && record.invoice.status !== InvoiceStatus.NOT_REQUIRED ? (
											<div className="flex items-center gap-2 whitespace-nowrap">
												<Badge
													variant="outline"
													className={
														record.invoice.status === InvoiceStatus.ISSUED
															? 'border-chart-5/30 bg-chart-5/15 text-chart-5'
															: 'border-chart-3/30 bg-chart-3/15 text-chart-3'
													}
												>
													{getInvoiceStatusLabel(record.invoice.status)}
												</Badge>
												{record.invoice.status === InvoiceStatus.ISSUED &&
													record.invoice.attachments &&
													record.invoice.attachments.length > 0 && (
														<button
															onClick={(e) => {
																e.stopPropagation();
																// Only preview the first one for now, or improve logic to show list
																// Simplest migration: show the first one or open a list dialog
																const attachments = record.invoice?.attachments || [];
																if (attachments.length > 0) {
																	handlePreview(attachments[0], record.name);
																}
															}}
															className="inline-flex h-6 items-center gap-1 rounded-full bg-secondary px-2 text-xs text-secondary-foreground hover:bg-secondary/80"
															title={`查看 ${record.invoice.attachments.length} 个附件`}
														>
															📎 {record.invoice.attachments.length}
														</button>
													)}
											</div>
										) : (
											<span className="text-sm text-muted-foreground">-</span>
										)}
									</TableCell>
									<TableCell className="px-4 py-3 text-right">
										{canEdit || canDelete ? (
											<div className="flex justify-end gap-2">
												{canEdit && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => onEdit(record)}
														className="h-8 px-2 text-primary hover:bg-primary/10 hover:text-primary"
													>
														编辑
													</Button>
												)}
												{canDelete && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleDelete(record)}
														className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
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

			<FilePreviewDialog
				open={previewOpen}
				fileUrl={previewFile}
				fileLabel={previewLabel}
				onClose={() => setPreviewOpen(false)}
			/>
		</div >
	);
}
