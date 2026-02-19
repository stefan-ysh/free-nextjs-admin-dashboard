import { MoreHorizontal } from 'lucide-react';

import PurchaseStatusBadge from './PurchaseStatusBadge';
import type { PurchaseRecord, PaymentMethod, PurchaseOrganization } from '@/types/purchase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DataState from '@/components/common/DataState';
import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dates';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
	style: 'currency',
	currency: 'CNY',
});

const paymentLabels: Record<PaymentMethod, string> = {
	wechat: '微信',
	alipay: '支付宝',
	bank_transfer: '银行转账',
	corporate_transfer: '对公转账',
	cash: '现金',
};

const organizationLabels: Record<PurchaseOrganization, string> = {
	school: '学校',
	company: '单位',
};

type PurchaseRowPermissions = {
	canEdit: boolean;
	canDelete: boolean;
	canDuplicate: boolean;
	canSubmit: boolean;
	canApprove: boolean;
	canTransfer: boolean;
	canReject: boolean;
	canPay: boolean;
	canSubmitReimbursement: boolean;
	canWithdraw: boolean;
	canReceive: boolean;
};

type PurchaseTableProps = {
	purchases: PurchaseRecord[];
	loading?: boolean;
	mutatingId?: string | null;
	scrollAreaClassName?: string;
	getRowPermissions: (purchase: PurchaseRecord) => PurchaseRowPermissions;
	onView: (purchase: PurchaseRecord) => void;
	onEdit: (purchase: PurchaseRecord) => void;
	onDuplicate: (purchase: PurchaseRecord) => void;
	onDelete: (purchase: PurchaseRecord) => void;
	onSubmit: (purchase: PurchaseRecord) => void;
	onApprove: (purchase: PurchaseRecord) => void;
	onTransfer: (purchase: PurchaseRecord) => void;
	onReject: (purchase: PurchaseRecord) => void;
	onWithdraw: (purchase: PurchaseRecord) => void;
	onPay: (purchase: PurchaseRecord) => void;
	onSubmitReimbursement: (purchase: PurchaseRecord) => void;
	onReceive: (purchase: PurchaseRecord) => void;
	getRowClassName?: (purchase: PurchaseRecord) => string;
};

function formatDate(value: string): string {
	return formatDateOnly(value) ?? value;
}

function formatQuantity(value: number): string {
	if (!Number.isFinite(value)) return '0';
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function getInitials(name?: string | null) {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
}

export default function PurchaseTable({
	purchases,
	loading,
	scrollAreaClassName,
	getRowPermissions,
	onView,
	onEdit,
	onDuplicate,
	onDelete,
	onSubmit,
	onApprove,
	onTransfer,
	onReject,
	onWithdraw,
	onPay,
	onSubmitReimbursement,
	onReceive,
	getRowClassName,
}: PurchaseTableProps) {
	const scrollContainerClassName = cn(
		'custom-scrollbar',
		scrollAreaClassName ?? 'max-h-[calc(100vh-280px)]'
	);

	if (loading) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="loading"
					title="正在加载采购数据"
					description="请稍候片刻，数据正在同步中"
				/>
			</div>
		);
	}

	if (purchases.length === 0) {
		return (
			<div className="surface-table p-6">
				<DataState
					variant="empty"
					title="暂无采购记录"
					description="尝试调整筛选条件或点击“发起采购”新增记录"
				/>
			</div>
		);
	}

	return (
		<div className="surface-table flex-1 min-h-0 flex flex-col">
            {/* Mobile View */}
			<div className="md:hidden">
				<div className="space-y-3 p-4">
					{purchases.map((purchase) => {
						const permissions = getRowPermissions(purchase);
						const rowClassName = getRowClassName?.(purchase);
						const inboundQuantity = Number(purchase.inboundQuantity ?? 0);
						const totalQuantity = Number(purchase.quantity ?? 0);
						return (
							<div key={purchase.id} className={cn("rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm", rowClassName)}>
								<div className="flex items-start justify-between gap-3">
									<div className="flex gap-3">
                                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                            <AvatarFallback>{getInitials(purchase.purchaserName)}</AvatarFallback>
                                        </Avatar>
                                        <div>
    										<div className="text-sm font-semibold text-foreground">{purchase.itemName}</div>
    										<div className="mt-1 text-xs text-muted-foreground">#{purchase.purchaseNumber}</div>
                                        </div>
									</div>
									<PurchaseStatusBadge status={purchase.status} />
								</div>
                                
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div>
                                        <span className="block opacity-70">申请人</span>
                                        <span className="font-medium text-foreground">{purchase.purchaserName || '—'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block opacity-70">金额</span>
                                        <span className="font-medium text-foreground">{currencyFormatter.format(purchase.totalAmount)}</span>
                                    </div>
                                </div>

								<div className="mt-3 pt-3 border-t border-dashed grid gap-1.5 text-xs text-muted-foreground">
									<div className="flex items-center justify-between gap-3">
										<span>采购日期</span>
										<span className="text-foreground">{formatDate(purchase.purchaseDate)}</span>
									</div>
                                    <div className="flex items-center justify-between gap-3">
										<span>组织 / 渠道</span>
										<span className="text-foreground">{organizationLabels[purchase.organizationType]} · {paymentLabels[purchase.paymentMethod]}</span>
									</div>
                                    {permissions.canReceive && (
                                        <div className="flex items-center justify-between gap-3 text-emerald-600">
                                            <span>入库进度</span>
                                            <span>{formatQuantity(inboundQuantity)} / {formatQuantity(totalQuantity)}</span>
                                        </div>
                                    )}
								</div>

								<div className="mt-4 flex items-center justify-end gap-2">
									<Button variant="outline" size="sm" onClick={() => onView(purchase)} className="h-8">
										详情
									</Button>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <span className="sr-only">打开菜单</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[160px]">
                                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => onView(purchase)}>
                                                查看详情
                                            </DropdownMenuItem>
                                            {permissions.canEdit && (
                                                <DropdownMenuItem onClick={() => onEdit(purchase)}>
                                                    编辑记录
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canReceive && (
                                                <DropdownMenuItem onClick={() => onReceive(purchase)}>
                                                    到货入库
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canDuplicate && (
                                                <DropdownMenuItem onClick={() => onDuplicate(purchase)}>
                                                    复制记录
                                                </DropdownMenuItem>
                                            )}
                                            
                                            <DropdownMenuSeparator />
                                            
                                            {permissions.canSubmit && (
                                                <DropdownMenuItem onClick={() => onSubmit(purchase)}>
                                                    提交审批
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canWithdraw && (
                                                <DropdownMenuItem onClick={() => onWithdraw(purchase)}>
                                                    撤回申请
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canApprove && (
                                                <DropdownMenuItem onClick={() => onApprove(purchase)}>
                                                    批准申请
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canTransfer && (
                                                <DropdownMenuItem onClick={() => onTransfer(purchase)}>
                                                    转交审批
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canReject && (
                                                <DropdownMenuItem onClick={() => onReject(purchase)} className="text-destructive focus:text-destructive">
                                                    驳回申请
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canPay && (
                                                <DropdownMenuItem onClick={() => onPay(purchase)}>
                                                    标记打款
                                                </DropdownMenuItem>
                                            )}
                                            {permissions.canSubmitReimbursement && (
                                                <DropdownMenuItem onClick={() => onSubmitReimbursement(purchase)}>
                                                    提交报销
                                                </DropdownMenuItem>
                                            )}
                                            
                                            {(permissions.canDelete) && <DropdownMenuSeparator />}
                                            {permissions.canDelete && (
                                                <DropdownMenuItem onClick={() => onDelete(purchase)} className="text-destructive focus:text-destructive">
                                                    删除记录
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
								</div>
							</div>
						);
					})}
				</div>
			</div>

            {/* Desktop View */}
			<div className="hidden md:flex md:flex-col flex-1 min-h-0">
				<Table
					stickyHeader
					scrollAreaClassName={scrollContainerClassName}
					className="min-w-[1000px] text-sm text-foreground bg-background [&_tbody_tr]:border-b [&_tbody_tr]:border-gray-100 dark:[&_tbody_tr]:border-gray-800 [&_tbody_tr]:last:border-0 hover:[&_tbody_tr]:bg-gray-50/50 dark:hover:[&_tbody_tr]:bg-gray-900/50"
				>
					<TableHeader className="bg-gray-50/50 dark:bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
						<TableRow className="hover:bg-transparent border-b border-gray-200 dark:border-gray-800">
							<TableHead className="w-[280px] px-4 py-3 pl-6">物品 / 单号</TableHead>
                            <TableHead className="w-[180px] px-4 py-3">申请人</TableHead>
							<TableHead className="w-[120px] px-4 py-3">金额</TableHead>
							<TableHead className="w-[140px] px-4 py-3">状态</TableHead>
							<TableHead className="w-[120px] px-4 py-3">采购日期</TableHead>
							<TableHead className="px-4 py-3">属性</TableHead>
							<TableHead className="w-[60px] px-4 py-3 text-right pr-6"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{purchases.map((purchase) => {
							const permissions = getRowPermissions(purchase);
							const rowClassName = getRowClassName?.(purchase);
							const inboundQuantity = Number(purchase.inboundQuantity ?? 0);
							const totalQuantity = Number(purchase.quantity ?? 0);
							const remainingInboundQuantity = Math.max(0, totalQuantity - inboundQuantity);
                            
							return (
								<TableRow 
                                    key={purchase.id} 
                                    className={cn("group transition-colors hover:bg-muted/40 cursor-pointer", rowClassName)}
                                    onClick={() => onView(purchase)}
                                >
									<TableCell className="px-4 py-3 pl-6 align-top">
										<div className="font-medium text-foreground">{purchase.itemName}</div>
										<div className="font-mono text-xs text-muted-foreground mt-0.5">{purchase.purchaseNumber}</div>
                                        {remainingInboundQuantity > 0 && inboundQuantity > 0 && (
                                            <div className="mt-1.5 inline-flex items-center rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                                                入库: {formatQuantity(inboundQuantity)}/{formatQuantity(totalQuantity)}
                                            </div>
                                        )}
									</TableCell>
                                    <TableCell className="px-4 py-3 align-top">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-[10px]">{getInitials(purchase.purchaserName)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm text-foreground/80">{purchase.purchaserName || '未知用户'}</span>
                                        </div>
									</TableCell>
									<TableCell className="px-4 py-3 align-top font-medium tracking-tight">
										{currencyFormatter.format(purchase.totalAmount)}
									</TableCell>
									<TableCell className="px-4 py-3 align-top">
										<PurchaseStatusBadge status={purchase.status} />
									</TableCell>
									<TableCell className="px-4 py-3 align-top text-muted-foreground">
										{formatDate(purchase.purchaseDate)}
									</TableCell>
									<TableCell className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1">
                                            <span className="inline-flex max-w-fit items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                {organizationLabels[purchase.organizationType]}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {paymentLabels[purchase.paymentMethod]}
                                            </span>
                                        </div>
									</TableCell>
									<TableCell className="px-4 py-3 pr-6 text-right align-top" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100">
                                                    <span className="sr-only">打开菜单</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px]">
                                                <DropdownMenuLabel>操作</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onView(purchase)}>
                                                    查看详情
                                                </DropdownMenuItem>
                                                {permissions.canEdit && (
                                                    <DropdownMenuItem onClick={() => onEdit(purchase)}>
                                                        编辑记录
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canReceive && (
                                                    <DropdownMenuItem onClick={() => onReceive(purchase)}>
                                                        到货入库
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canDuplicate && (
                                                    <DropdownMenuItem onClick={() => onDuplicate(purchase)}>
                                                        复制记录
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                <DropdownMenuSeparator />
                                                
                                                {permissions.canSubmit && (
                                                    <DropdownMenuItem onClick={() => onSubmit(purchase)}>
                                                        提交审批
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canWithdraw && (
                                                    <DropdownMenuItem onClick={() => onWithdraw(purchase)}>
                                                        撤回申请
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canApprove && (
                                                    <DropdownMenuItem onClick={() => onApprove(purchase)}>
                                                        批准申请
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canTransfer && (
                                                    <DropdownMenuItem onClick={() => onTransfer(purchase)}>
                                                        转交审批
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canReject && (
                                                    <DropdownMenuItem onClick={() => onReject(purchase)} className="text-destructive focus:text-destructive">
                                                        驳回申请
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canPay && (
                                                    <DropdownMenuItem onClick={() => onPay(purchase)}>
                                                        标记打款
                                                    </DropdownMenuItem>
                                                )}
                                                {permissions.canSubmitReimbursement && (
                                                    <DropdownMenuItem onClick={() => onSubmitReimbursement(purchase)}>
                                                        提交报销
                                                    </DropdownMenuItem>
                                                )}
                                                
                                                {(permissions.canDelete) && <DropdownMenuSeparator />}
                                                {permissions.canDelete && (
                                                    <DropdownMenuItem onClick={() => onDelete(purchase)} className="text-destructive focus:text-destructive">
                                                        删除记录
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

export type { PurchaseRowPermissions };
