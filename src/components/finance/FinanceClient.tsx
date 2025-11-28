'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FinanceRecord, FinanceStats } from '@/types/finance';
import FinanceTable from './FinanceTable';
import FinanceForm, { FinanceFormSubmitPayload } from './FinanceForm';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionType } from '@/types/finance';
import { getCategoryGroups } from '@/constants/finance-categories';

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
}

export default function FinanceClient({
    records,
    stats,
    categories,
    pagination,
    permissions,
}: FinanceClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
    const [keywordInput, setKeywordInput] = useState(searchParams.get('keyword') || '');
    const [minAmountInput, setMinAmountInput] = useState(searchParams.get('minAmount') || '');
    const [maxAmountInput, setMaxAmountInput] = useState(searchParams.get('maxAmount') || '');

    const currentRange = searchParams.get('range') || 'all';
    const currentTypeParam = searchParams.get('type') || 'all';
    const categoryParam = searchParams.get('category') || 'all';
    const keywordParam = searchParams.get('keyword') || '';
    const minAmountParam = searchParams.get('minAmount') || '';
    const maxAmountParam = searchParams.get('maxAmount') || '';
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
            return getCategoryGroups(TransactionType.INCOME, categories.income);
        }
        if (selectedType === TransactionType.EXPENSE) {
            return getCategoryGroups(TransactionType.EXPENSE, categories.expense);
        }
        const incomeGroups = getCategoryGroups(TransactionType.INCOME, categories.income).map((group) => ({
            label: `收入 · ${group.label}`,
            options: group.options,
        }));
        const expenseGroups = getCategoryGroups(TransactionType.EXPENSE, categories.expense).map((group) => ({
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
            const endDate = now.toISOString().slice(0, 10);

            if (value === '30d') {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                startDate = d.toISOString().slice(0, 10);
            } else if (value === '90d') {
                const d = new Date();
                d.setDate(d.getDate() - 90);
                startDate = d.toISOString().slice(0, 10);
            } else if (value === 'ytd') {
                startDate = `${now.getFullYear()}-01-01`;
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

    const handleResetFilters = () => {
        setKeywordInput('');
        setMinAmountInput('');
        setMaxAmountInput('');
        updateFilters((params) => {
            ['type', 'category', 'keyword', 'minAmount', 'maxAmount', 'range', 'startDate', 'endDate'].forEach((key) =>
                params.delete(key)
            );
        });
    };

    const handleSubmit = async (data: FinanceFormSubmitPayload) => {
        try {
            const url = editingRecord
                ? `/api/finance/records/${editingRecord.id}`
                : '/api/finance/records';
            const method = editingRecord ? 'PATCH' : 'POST';

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

            toast.success(editingRecord ? '记录更新成功' : '记录添加成功');
            setIsDrawerOpen(false);
            setEditingRecord(null);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('操作失败');
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
            {/* Stats Section */}


            <FinanceStatsCards stats={stats} />

            {/* Filters */}
            <div className="rounded-lg border border-border bg-white p-3 dark:bg-gray-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">时间范围</span>
                            <Select value={currentRange} onValueChange={handleRangeChange}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="时间范围" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30d">近 30 天</SelectItem>
                                    <SelectItem value="90d">近 90 天</SelectItem>
                                    <SelectItem value="ytd">本年度</SelectItem>
                                    <SelectItem value="all">全部数据</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">收支类型</span>
                            <Select value={selectedType} onValueChange={handleTypeChange}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="全部" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全部</SelectItem>
                                    <SelectItem value={TransactionType.INCOME}>仅收入</SelectItem>
                                    <SelectItem value={TransactionType.EXPENSE}>仅支出</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">分类</span>
                            <Select value={categoryValue} onValueChange={handleCategoryChange}>
                                <SelectTrigger className="h-9">
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

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">金额范围</span>
                            <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="Min"
                                    className="h-9 px-2 text-xs"
                                    value={minAmountInput}
                                    onChange={(e) => setMinAmountInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="Max"
                                    className="h-9 px-2 text-xs"
                                    value={maxAmountInput}
                                    onChange={(e) => setMaxAmountInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">搜索</span>
                            <Input
                                placeholder="搜索名称/备注"
                                className="h-9"
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <Button variant="secondary" size="sm" onClick={handleApplyFilters} className="h-9">
                            查询
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-9 px-2 text-muted-foreground">
                            重置
                        </Button>
                    </div>
                </div>
            </div>

            {/* Records Section */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">财务记录</h2>
                {permissions.canManage && (
                    <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                        <SheetTrigger asChild>
                            <Button onClick={() => setEditingRecord(null)}>+ 添加记录</Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="sm:max-w-xl">
                            <SheetHeader>
                                <SheetTitle>{editingRecord ? '编辑记录' : '添加记录'}</SheetTitle>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto">
                                <FinanceForm
                                    initialData={editingRecord || undefined}
                                    onSubmit={handleSubmit}
                                    onCancel={() => setIsDrawerOpen(false)}
                                    incomeCategories={categories.income}
                                    expenseCategories={categories.expense}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
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
                <div className="flex items-center justify-end space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                    >
                        上一页
                    </Button>
                    <div className="text-sm font-medium">
                        第 {pagination.page} / {pagination.totalPages} 页
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                    >
                        下一页
                    </Button>
                </div>
            )}
        </div>
    );
}
