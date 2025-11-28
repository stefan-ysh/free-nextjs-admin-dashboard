import * as XLSX from 'xlsx';

export interface QuoteItem {
    name: string;
    spec: string;
    unit: string;
    price: number;
    quantity: number;
}

export interface QuoteData {
    customerName?: string;
    items: QuoteItem[];
}

export interface DeliveryItem {
    name: string;
    spec: string;
    quantity: number;
    unit: string;
    price?: number;
}

export interface DeliveryNoteData {
    customerName: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
    date: string;
    items: DeliveryItem[];
}

async function fetchTemplate(filename: string): Promise<ArrayBuffer> {
    const response = await fetch(`/templates/${filename}`);
    if (!response.ok) {
        throw new Error(`Failed to load template: ${filename}`);
    }
    return await response.arrayBuffer();
}

function saveWorkbook(workbook: XLSX.WorkBook, filename: string) {
    XLSX.writeFile(workbook, filename);
}

/**
 * 导出报价单
 */
export async function exportQuote(data: QuoteData) {
    try {
        const buffer = await fetchTemplate('quote_template.xls');
        const workbook = XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // 1. 填充基础数据 (如果有特定位置需要填充客户名，可以在这里处理)
        // 目前模板似乎没有明确的客户名占位符，主要在表头

        // 2. 填充商品明细
        // 模板数据从第4行(索引3)开始: 序号, 名称, 规格, 单位, 单价, 数量, 金额
        const startRow = 3;

        // 转换数据为数组格式
        const rows = data.items.map((item, index) => [
            index + 1,      // 序号
            item.name,      // 名称
            item.spec,      // 规格
            item.unit,      // 单位
            item.price,     // 单价
            item.quantity,  // 数量
            item.price * item.quantity, // 金额
        ]);

        // 使用 sheet_add_aoa 写入数据，origin 指定起始位置
        XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: { r: startRow, c: 0 } });

        // 3. 计算总金额并写入小计行 (紧接在数据之后)
        const totalAmount = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const totalRowIndex = startRow + rows.length;

        // 写入小计行
        XLSX.utils.sheet_add_aoa(worksheet, [
            ['', '小计（含税 13% 增票）', '', '', '', '', totalAmount]
        ], { origin: { r: totalRowIndex, c: 0 } });

        // 导出
        const filename = `报价单_${data.customerName || '未命名'}_${new Date().toISOString().slice(0, 10)}.xls`;
        saveWorkbook(workbook, filename);

    } catch (error) {
        console.error('Export quote failed:', error);
        throw error;
    }
}

/**
 * 导出发货单
 */
export async function exportDeliveryNote(data: DeliveryNoteData) {
    try {
        const buffer = await fetchTemplate('delivery_template.xls');
        const workbook = XLSX.read(buffer, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // 1. 填充表头信息
        // B2: 发货时间
        // B3: 客户名称
        // B4: 地址
        // G3: 联系人
        // G4: 电话

        // 注意：XLSX.utils.sheet_add_aoa 可能会覆盖原有样式，直接修改 cell 对象更安全
        const updateCell = (r: number, c: number, value: string | number) => {
            const cellAddress = XLSX.utils.encode_cell({ r, c });
            if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
            worksheet[cellAddress].v = value;
        };

        // 填充表头 (索引从0开始)
        // Row 1 (Index 1): 发货时间 (Col B / Index 1)
        updateCell(1, 1, data.date);

        // Row 2 (Index 2): 客户名称 (Col B / Index 1) -> 实际上模板里是 "名 称：北京农科院"，我们需要替换后面的部分
        // 简单起见，我们直接覆盖整个单元格，或者只替换内容
        updateCell(2, 1, `名 称：${data.customerName}`);
        updateCell(2, 6, data.contactPerson || ''); // G3 (Index 2, 6)

        // Row 3 (Index 3): 地址
        updateCell(3, 1, `地 址：${data.address || ''}`);
        updateCell(3, 6, data.phone || ''); // G4 (Index 3, 6)

        // 2. 填充发货明细
        // 数据从第6行(索引5)开始: 序号, 产品名称, 型号, 数量, 单位, 单价, 总金额
        const startRow = 5;

        const rows = data.items.map((item, index) => [
            index + 1,
            item.name,
            item.spec,
            item.quantity,
            item.unit,
            item.price || 0,
            (item.price || 0) * item.quantity,
        ]);

        XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: { r: startRow, c: 0 } });

        // 导出
        const filename = `发货单_${data.customerName}_${data.date}.xls`;
        saveWorkbook(workbook, filename);

    } catch (error) {
        console.error('Export delivery note failed:', error);
        throw error;
    }
}
