import { useState } from 'react';
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportQuote, type QuoteData, type QuoteItem } from '@/lib/excel-export';
import type { InventoryItem } from '@/types/inventory';

interface QuoteGeneratorDialogProps {
    selectedItems: InventoryItem[];
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export default function QuoteGeneratorDialog({ selectedItems, onOpenChange, trigger }: QuoteGeneratorDialogProps) {
    const [open, setOpen] = useState(false);
    const [customerName, setCustomerName] = useState('');

    // 初始化报价项，默认数量为1，价格为销售价
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() =>
        selectedItems.map(item => ({
            name: item.name,
            spec: item.specFields?.map(f => `${f.label}:${f.defaultValue || ''}`).join(' ') || '',
            unit: item.unit,
            price: item.salePrice || 0,
            quantity: 1,
        }))
    );

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);

        // 每次打开时重置（如果需要保留上次编辑状态则去掉这行）
        if (newOpen) {
            setQuoteItems(selectedItems.map(item => ({
                name: item.name,
                spec: item.specFields?.map(f => `${f.label}:${f.defaultValue || ''}`).join(' ') || '',
                unit: item.unit,
                price: item.salePrice || 0,
                quantity: 1,
            })));
        }
    };

    const updateItem = (index: number, field: keyof QuoteItem, value: string | number) => {
        const newItems = [...quoteItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setQuoteItems(newItems);
    };

    const removeItem = (index: number) => {
        setQuoteItems(quoteItems.filter((_, i) => i !== index));
    };

    const addItem = () => {
        setQuoteItems([
            ...quoteItems,
            { name: '', spec: '', unit: '个', price: 0, quantity: 1 }
        ]);
    };

    const handleExport = async () => {
        if (!customerName.trim()) {
            toast.error('请输入客户名称');
            return;
        }

        if (quoteItems.length === 0) {
            toast.error('报价单不能为空');
            return;
        }

        const data: QuoteData = {
            customerName,
            items: quoteItems,
        };

        try {
            await exportQuote(data);
            toast.success('报价单生成成功');
            setOpen(false);
        } catch (error) {
            console.error(error);
            toast.error('生成失败，请检查模板');
        }
    };

    const totalAmount = quoteItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        生成报价单
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>生成报价单</DialogTitle>
                    <DialogDescription>
                        基于选中的 {selectedItems.length} 个商品生成报价单，您可以调整价格和数量。
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="customer">客户名称</Label>
                        <Input
                            id="customer"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="请输入客户公司名称"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>报价明细</Label>
                            <Button variant="ghost" size="sm" onClick={addItem} className="h-8 gap-1">
                                <Plus className="h-3 w-3" /> 添加自定义项
                            </Button>
                        </div>

                        <div className="border rounded-md">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-12">#</th>
                                        <th className="px-3 py-2 text-left">名称</th>
                                        <th className="px-3 py-2 text-left">规格</th>
                                        <th className="px-3 py-2 text-left w-20">单位</th>
                                        <th className="px-3 py-2 text-left w-24">单价</th>
                                        <th className="px-3 py-2 text-left w-20">数量</th>
                                        <th className="px-3 py-2 text-right w-24">金额</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {quoteItems.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={item.name}
                                                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                                                    className="h-8"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={item.spec}
                                                    onChange={(e) => updateItem(index, 'spec', e.target.value)}
                                                    className="h-8"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                    className="h-8"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                                                    className="h-8"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                                    className="h-8"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">
                                                ¥{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-medium">
                                    <tr>
                                        <td colSpan={6} className="px-3 py-2 text-right">总计：</td>
                                        <td className="px-3 py-2 text-right text-lg">¥{totalAmount.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button onClick={handleExport}>确认生成 Excel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
