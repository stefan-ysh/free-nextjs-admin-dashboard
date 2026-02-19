import * as XLSX from 'xlsx';



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
