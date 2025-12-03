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
		<div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
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
										className={record.type === TransactionType.INCOME ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
									>
										{record.type === TransactionType.INCOME ? '收入' : '支出'}
									</Badge>
								</TableCell>
								<TableCell className="px-4 py-3 text-sm text-muted-foreground">
									{record.category}
								</TableCell>
								<TableCell
									className={`px-4 py-3 font-semibold ${record.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-red-600'}`}
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
														? 'border-emerald-200 bg-emerald-50 text-emerald-700'
														: 'border-amber-200 bg-amber-50 text-amber-700'
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
														const attachments = record.invoice?.attachments || [];

														const dialog = document.createElement('div');
														dialog.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
														dialog.onclick = () => dialog.remove();

														const content = document.createElement('div');
														content.className = 'bg-white dark:bg-gray-900 rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto';
														content.onclick = (event) => event.stopPropagation();

														const header = document.createElement('div');
														header.className = 'flex items-center justify-between mb-4 pb-3 border-b border-border';
														header.innerHTML = `
															<h3 class="text-lg font-semibold">附件预览 (${attachments.length} 个文件)</h3>
															<button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none" onclick="this.closest('.fixed').remove()">&times;</button>
														`;

														const grid = document.createElement('div');
														grid.className = 'grid gap-4 md:grid-cols-2';

														attachments.forEach((file, idx) => {
															const isImage = file.startsWith('data:image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(file);
															const item = document.createElement('div');

															if (isImage) {
																item.className = 'space-y-2';
																const img = document.createElement('img');
																img.src = file;
																img.alt = `附件 ${idx + 1}`;
																img.className = 'w-full max-h-[400px] object-contain rounded border border-border cursor-pointer hover:opacity-90 transition-opacity';
																img.onclick = () => {
																	const newWindow = window.open();
																	if (newWindow) {
																		newWindow.document.write(`
																			<!DOCTYPE html>
																			<html>
																				<head>
																					<title>附件 ${idx + 1}</title>
																					<style>
																						body { margin: 0; padding: 20px; background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
																						img { max-width: 100%; max-height: 100vh; object-fit: contain; }
																					</style>
																				</head>
																				<body><img src="${file}" alt="附件 ${idx + 1}" /></body>
																		</html>
																		`);
																	}
																};
																item.appendChild(img);

																const link = document.createElement('a');
																link.href = file;
																link.download = `附件_${idx + 1}`;
																link.className = 'inline-block text-xs text-blue-600 hover:underline dark:text-blue-400';
																link.textContent = '点击放大查看';
																item.appendChild(link);
															} else {
																item.className = 'flex items-center justify-between rounded border border-border bg-muted/50 px-4 py-3';
																item.innerHTML = `
																	<span class="text-sm">附件 ${idx + 1}</span>
																	<a href="${file}" target="_blank" class="text-sm text-blue-600 hover:underline dark:text-blue-400">打开</a>
																`;
															}
															grid.appendChild(item);
														});

														content.appendChild(header);
														content.appendChild(grid);
														dialog.appendChild(content);
														document.body.appendChild(dialog);
													}}
													className="inline-flex h-6 items-center gap-1 rounded-full bg-blue-50 px-2 text-xs text-blue-700 hover:bg-blue-100"
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
													className="h-8 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
												>
													编辑
												</Button>
											)}
											{canDelete && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDelete(record)}
													className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
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
