'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FinanceRecord, FinanceStats } from '@/types/finance';
import FinanceTable from './FinanceTable';
import FinanceForm, { FinanceFormSubmitPayload } from './FinanceForm';
import QuickEntryForm from './QuickEntryForm';
import FinanceStatsCards from './FinanceStatsCards';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { TransactionType } from '@/types/finance';
import { Badge } from '@/components/ui/badge';
import { getCategoryGroups, getPinnedCategoryLabels } from '@/constants/finance-categories';
import UserSelect from '@/components/common/UserSelect';
import { formatDateOnly } from '@/lib/dates';
import {
    FORM_DRAWER_WIDTH_STANDARD,
    FORM_DRAWER_WIDTH_WIDE,
} from '@/components/common/form-drawer-width';

interface FinanceClientProps {
    records: FinanceRecord[];
    stats: FinanceStats;
    categories: { income: string[]; expense: string[] };
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    permissions: {
        canView: boolean;
        canManage: boolean;
    };
    currentUserId: string;
}

export default function FinanceClient({
    records,
    stats,
    categories,
    pagination,
    permissions,
    currentUserId,
}: FinanceClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
    const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [keywordInput, setKeywordInput] = useState(searchParams.get('keyword') || '');
    const [minAmountInput, setMinAmountInput] = useState(searchParams.get('minAmount') || '');
    const [maxAmountInput, setMaxAmountInput] = useState(searchParams.get('maxAmount') || '');

    const currentRange = searchParams.get('range') || 'all';
    const currentTypeParam = searchParams.get('type') || 'all';
    const categoryParam = searchParams.get('category') || 'all';
    const keywordParam = searchParams.get('keyword') || '';
    const minAmountParam = searchParams.get('minAmount') || '';
    const maxAmountParam = searchParams.get('maxAmount') || '';
    const handlerIdParam = searchParams.get('handlerId') || '';
    const selectedType =
        currentTypeParam === TransactionType.INCOME || currentTypeParam === TransactionType.EXPENSE
            ? currentTypeParam
            : 'all';

    useEffect(() => {
        setKeywordInput(keywordParam);
        setMinAmountInput(minAmountParam);
        setMaxAmountInput(maxAmountParam);

        // Handle quick create action from URL
        if (searchParams.get('action') === 'new') {
            setIsDrawerOpen(true);
            setEditingRecord(null);
            // Optional: Clean up the URL after opening
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('action');
            router.replace(`${pathname}?${newParams.toString()}`);
        }
    }, [keywordParam, minAmountParam, maxAmountParam, searchParams, pathname, router]);

    const categoryGroups = useMemo(() => {
        if (selectedType === TransactionType.INCOME) {
            return getCategoryGroups(
                TransactionType.INCOME,
                categories.income,
                getPinnedCategoryLabels(TransactionType.INCOME)
            );
        }
        if (selectedType === TransactionType.EXPENSE) {
            return getCategoryGroups(
                TransactionType.EXPENSE,
                categories.expense,
                getPinnedCategoryLabels(TransactionType.EXPENSE)
            );
        }
        const incomeGroups = getCategoryGroups(
            TransactionType.INCOME,
            categories.income,
            getPinnedCategoryLabels(TransactionType.INCOME)
        ).map((group) => ({
            label: `收入 · ${group.label}`,
            options: group.options,
        }));
        const expenseGroups = getCategoryGroups(
            TransactionType.EXPENSE,
            categories.expense,
            getPinnedCategoryLabels(TransactionType.EXPENSE)
        ).map((group) => ({
            label: `支出 · ${group.label}`,
            options: group.options,
        }));
        return [...incomeGroups, ...expenseGroups];
    }, [categories.expense, categories.income, selectedType]);

    const categoryOptions = useMemo(
        () => categoryGroups.flatMap((group) => group.options.map((option) => option.label)),
        [categoryGroups]
    );
    const categoryValue =
        categoryParam === 'all' || !categoryOptions.includes(categoryParam)
            ? 'all'
            : categoryParam;

    const activeFilterChips = useMemo(() => {
        const chips: Array<{ label: string; onRemove: () => void }> = [];
        if (currentRange !== 'all') {
            const rangeLabelMap: Record<string, string> = {
                this_week: '本周',
                this_month: '本月',
                last_month: '上月',
                '30d': '近 30 天',
                '90d': '近 90 天',
                ytd: '本年度',
            };
            chips.push({
                label: rangeLabelMap[currentRange] ?? currentRange,
                onRemove: () => handleRangeChange('all'),
            });
        }
        if (selectedType !== 'all') {
            chips.push({
                label: selectedType === TransactionType.INCOME ? '仅收入' : '仅支出',
                onRemove: () => handleTypeChange('all'),
            });
        }
        if (categoryValue !== 'all') {
            chips.push({
                label: `分类：${categoryValue}`,
                onRemove: () => handleCategoryChange('all'),
            });
        }
        if (minAmountParam) {
            chips.push({
                label: `金额≥${minAmountParam}`,
                onRemove: () => updateFilters((params) => params.delete('minAmount')),
            });
        }
        if (maxAmountParam) {
            chips.push({
                label: `金额≤${maxAmountParam}`,
                onRemove: () => updateFilters((params) => params.delete('maxAmount')),
            });
        }
        if (handlerIdParam) {
            chips.push({
                label: '经办人已选',
                onRemove: () => updateFilters((params) => params.delete('handlerId')),
            });
        }
        if (keywordParam) {
            chips.push({
                label: `关键词：${keywordParam}`,
                onRemove: () => updateFilters((params) => params.delete('keyword')),
            });
        }
        return chips;
    }, [
        categoryValue,
        currentRange,
        handlerIdParam,
        keywordParam,
        maxAmountParam,
        minAmountParam,
        selectedType,
    ]);

    const activeFilterCount = activeFilterChips.length;

    const updateFilters = (mutator: (params: URLSearchParams) => void) => {
        const params = new URLSearchParams(searchParams.toString());
        mutator(params);
        params.set('page', '1');
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    };

    const handleRangeChange = (value: string) => {
        updateFilters((params) => {
            params.set('range', value);

            if (value === 'all') {
                params.delete('startDate');
                params.delete('endDate');
                return;
            }

            const now = new Date();
            let startDate = '';
            const endDate = formatDateOnly(now) ?? now.toISOString().slice(0, 10);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            if (value === '30d') {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                startDate = formatDateOnly(d) ?? d.toISOString().slice(0, 10);
            } else if (value === '90d') {
                const d = new Date();
                d.setDate(d.getDate() - 90);
                startDate = formatDateOnly(d) ?? d.toISOString().slice(0, 10);
            } else if (value === 'ytd') {
                startDate = `${now.getFullYear()}-01-01`;
            } else if (value === 'this_month') {
                startDate = formatDateOnly(startOfMonth) ?? startOfMonth.toISOString().slice(0, 10);
            } else if (value === 'last_month') {
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                params.set('startDate', formatDateOnly(lastMonthStart) ?? lastMonthStart.toISOString().slice(0, 10));
                params.set('endDate', formatDateOnly(lastMonthEnd) ?? lastMonthEnd.toISOString().slice(0, 10));
                return;
            } else if (value === 'this_week') {
                const day = now.getDay() || 7;
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - (day - 1));
                startDate = formatDateOnly(weekStart) ?? weekStart.toISOString().slice(0, 10);
            }

            if (startDate) {
                params.set('startDate', startDate);
            } else {
                params.delete('startDate');
            }
            params.set('endDate', endDate);
        });
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', newPage.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleTypeChange = (value: string) => {
        updateFilters((params) => {
            if (value === 'all') {
                params.delete('type');
            } else {
                params.set('type', value);
            }
            params.delete('category');
        });
    };

    const handleCategoryChange = (value: string) => {
        updateFilters((params) => {
            if (value === 'all') {
                params.delete('category');
            } else {
                params.set('category', value);
            }
        });
    };

    const handleApplyFilters = () => {
        updateFilters((params) => {
            const keyword = keywordInput.trim();
            const minAmount = minAmountInput.trim();
            const maxAmount = maxAmountInput.trim();

            if (keyword) {
                params.set('keyword', keyword);
            } else {
                params.delete('keyword');
            }

            if (minAmount) {
                params.set('minAmount', minAmount);
            } else {
                params.delete('minAmount');
            }

            if (maxAmount) {
                params.set('maxAmount', maxAmount);
            } else {
                params.delete('maxAmount');
            }
        });
    };

    const applyAmountRange = (min: number, max: number) => {
        setMinAmountInput(String(min));
        setMaxAmountInput(String(max));
        updateFilters((params) => {
            params.set('minAmount', String(min));
            params.set('maxAmount', String(max));
        });
    };

    const handleResetFilters = () => {
        setKeywordInput('');
        setMinAmountInput('');
        setMaxAmountInput('');
        updateFilters((params) => {
            ['type', 'category', 'keyword', 'minAmount', 'maxAmount', 'range', 'startDate', 'endDate', 'handlerId'].forEach((key) =>
                params.delete(key)
            );
        });
    };

    const submitRecord = async (data: FinanceFormSubmitPayload, recordId?: string) => {
        try {
            const url = recordId
                ? `/api/finance/records/${recordId}`
                : '/api/finance/records';
            const method = recordId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error || '操作失败');
                return;
            }

            toast.success(recordId ? '记录更新成功' : '记录添加成功');
            router.refresh();
            return true;
        } catch (error) {
            console.error(error);
            toast.error('操作失败');
            return false;
        }
    };

    const handleSubmit = async (data: FinanceFormSubmitPayload) => {
        const success = await submitRecord(data, editingRecord?.id);
        if (success) {
            setIsDrawerOpen(false);
            setEditingRecord(null);
        }
    };

    const handleQuickSubmit = async (data: FinanceFormSubmitPayload) => {
        const success = await submitRecord(data);
        if (success) {
            setIsQuickDrawerOpen(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/finance/records/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('删除成功');
                router.refresh();
            } else {
                toast.error('删除失败');
            }
        } catch (error) {
            console.error(error);
            toast.error('删除失败');
        }
    };

    if (!permissions.canView) {
        return (
            <div className="rounded-lg border border-red-200 bg-white p-6 text-red-600 shadow dark:border-red-800 dark:bg-gray-900 dark:text-red-300">
                当前账户无权访问财务模块，请联系管理员开通权限。
            </div>
        );
    }

    return (
        <div className="space-y-6 p-0">
            <FinanceStatsCards stats={stats} />

            {/* Filters */}
            <div className="surface-toolbar p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                            placeholder="搜索名称/备注"
                            className="h-10 w-full"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                        />
                        <Button variant="secondary" size="sm" onClick={handleApplyFilters} className="h-10 px-4">
                            查询
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="right">
                            <DrawerTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 px-4">
                                    筛选
                                    {activeFilterCount > 0 && (
                                        <Badge className="ml-1 rounded-full px-2 py-0 text-[10px]" variant="secondary">
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            </DrawerTrigger>
                            <DrawerContent side="right" className="sm:max-w-xl">
                                <DrawerHeader>
                                    <DrawerTitle>筛选条件</DrawerTitle>
                                </DrawerHeader>
                                <DrawerBody className="space-y-4">
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">时间范围</span>
                                        <Select value={currentRange} onValueChange={handleRangeChange}>
                                            <SelectTrigger className="h-10 w-full">
                                                <SelectValue placeholder="时间范围" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="this_week">本周</SelectItem>
                                                <SelectItem value="this_month">本月</SelectItem>
                                                <SelectItem value="last_month">上月</SelectItem>
                                                <SelectItem value="30d">近 30 天</SelectItem>
                                                <SelectItem value="90d">近 90 天</SelectItem>
                                                <SelectItem value="ytd">本年度</SelectItem>
                                                <SelectItem value="all">全部数据</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">收支类型</span>
                                        <Select value={selectedType} onValueChange={handleTypeChange}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="全部" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">全部</SelectItem>
                                                <SelectItem value={TransactionType.INCOME}>仅收入</SelectItem>
                                                <SelectItem value={TransactionType.EXPENSE}>仅支出</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">分类</span>
                                        <Select value={categoryValue} onValueChange={handleCategoryChange}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="全部分类" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72 overflow-y-auto">
                                                <SelectItem value="all">全部分类</SelectItem>
                                                {categoryGroups.map((group) => (
                                                    <SelectGroup key={`filter-${group.label}`}>
                                                        <SelectLabel className="text-xs text-muted-foreground">
                                                            {group.label}
                                                        </SelectLabel>
                                                        {group.options.map((option) => (
                                                            <SelectItem key={`${group.label}-${option.label}`} value={option.label}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">金额范围</span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Min"
                                                className="h-10 px-3 text-xs"
                                                value={minAmountInput}
                                                onChange={(e) => setMinAmountInput(e.target.value)}
                                            />
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Max"
                                                className="h-10 px-3 text-xs"
                                                value={maxAmountInput}
                                                onChange={(e) => setMaxAmountInput(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground">经办人</span>
                                        <UserSelect
                                            value={handlerIdParam}
                                            onChange={(value) => {
                                                updateFilters((params) => {
                                                    if (value) {
                                                        params.set('handlerId', value);
                                                    } else {
                                                        params.delete('handlerId');
                                                    }
                                                });
                                            }}
                                            placeholder="全部人员"
                                            className="h-10"
                                        />
                                    </div>
                                </DrawerBody>
                                <DrawerFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleResetFilters}
                                    >
                                        重置
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            handleApplyFilters();
                                            setFilterDrawerOpen(false);
                                        }}
                                    >
                                        应用筛选
                                    </Button>
                                </DrawerFooter>
                            </DrawerContent>
                        </Drawer>
                        <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-10 px-3 text-muted-foreground">
                            清空
                        </Button>
                        {permissions.canManage && (
                            <Drawer open={isQuickDrawerOpen} onOpenChange={setIsQuickDrawerOpen} direction="right">
                                <DrawerTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-10" onClick={() => setIsQuickDrawerOpen(true)}>
                                        快速记账
                                    </Button>
                                </DrawerTrigger>
                                <DrawerContent side="right" className={FORM_DRAWER_WIDTH_STANDARD}>
                                    <DrawerHeader>
                                        <DrawerTitle>快速记账</DrawerTitle>
                                    </DrawerHeader>
                                    <DrawerBody>
                                        <QuickEntryForm
                                            onSubmit={handleQuickSubmit}
                                            onCancel={() => setIsQuickDrawerOpen(false)}
                                            incomeCategories={categories.income}
                                            expenseCategories={categories.expense}
                                            currentUserId={currentUserId}
                                            formId="finance-quick-form"
                                            hideActions
                                        />
                                    </DrawerBody>
                                    <DrawerFooter>
                                        <DrawerClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setIsQuickDrawerOpen(false)}
                                            >
                                                取消
                                            </Button>
                                        </DrawerClose>
                                        <Button type="submit" form="finance-quick-form">
                                            快速添加
                                        </Button>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>
                        )}
                        {permissions.canManage && (
                            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} direction="right">
                                <DrawerTrigger asChild>
                                    <Button size="sm" className="h-10" onClick={() => setEditingRecord(null)}>+ 记一笔</Button>
                                </DrawerTrigger>
                                <DrawerContent side="right" className={FORM_DRAWER_WIDTH_WIDE}>
                                    <DrawerHeader>
                                        <DrawerTitle>{editingRecord ? '编辑记录' : '添加记录'}</DrawerTitle>
                                    </DrawerHeader>
                                    <DrawerBody>
                                        <FinanceForm
                                            initialData={editingRecord || undefined}
                                            onSubmit={handleSubmit}
                                            onCancel={() => setIsDrawerOpen(false)}
                                            incomeCategories={categories.income}
                                            expenseCategories={categories.expense}
                                            currentUserId={currentUserId}
                                            formId="finance-record-form"
                                            hideActions
                                            layoutMode="wide"
                                        />
                                    </DrawerBody>
                                    <DrawerFooter>
                                        <DrawerClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setIsDrawerOpen(false);
                                                    setEditingRecord(null);
                                                }}
                                            >
                                                取消
                                            </Button>
                                        </DrawerClose>
                                        <Button type="submit" form="finance-record-form">
                                            {editingRecord ? '更新记录' : '添加记录'}
                                        </Button>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>
                        )}
                    </div>
                </div>
                {activeFilterChips.length > 0 && (
                    <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                        {activeFilterChips.map((chip) => (
                            <Button
                                key={chip.label}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 rounded-full px-3 text-xs"
                                onClick={chip.onRemove}
                            >
                                {chip.label} ×
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            <FinanceTable
                records={records}
                onEdit={(record) => {
                    setEditingRecord(record);
                    setIsDrawerOpen(true);
                }}
                onDelete={handleDelete}
                canEdit={permissions.canManage}
                canDelete={permissions.canManage}
            />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
                    <div>共 {pagination.total} 条 · 第 {pagination.page} / {pagination.totalPages} 页</div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="h-9 px-3"
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="h-9 px-3"
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
