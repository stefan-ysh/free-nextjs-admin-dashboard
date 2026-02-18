import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatDateOnly } from '@/lib/dates';

/**
 * 导出列定义
 */
export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date';
}

/**
 * 导出数据项
 */
export type ExportItem = Record<string, any>;

/**
 * 图片配置
 */
export interface ImageConfig {
  key: string; // 数据中图片 URL 对应的字段名
  width?: number;
  height?: number;
}

export class ExportUtils {
  /**
   * 下载图片并转换为 Buffer
   */
  private static async fetchImage(url: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      return await response.arrayBuffer();
    } catch (error) {
      console.warn(`Failed to process image ${url}:`, error);
      return null;
    }
  }

  /**
   * 生成并下载 Excel 文件
   */
  static async exportToExcel(
    params: {
      filename: string;
      sheetName?: string;
      columns: ExportColumn[];
      data: ExportItem[];
      imageKeys?: string[]; // 需要作为图片处理的字段 key
    }
  ) {
    const { filename, sheetName = 'Sheet1', columns, data, imageKeys = [] } = params;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    // 1. 设置表头
    sheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    // 美化表头
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 30;

    // 2. 填充数据
    // 我们需要逐行处理，因为涉及到图片嵌入，可能需要异步操作
    // 为了保持顺序并正确插入图片，我们在循环中处理，但对于图片的 fetch 可以并发
    
    // 预处理：找出哪些列也是 imageKeys
    const imageColIndices = new Map<string, number>();
    imageKeys.forEach(key => {
        const idx = columns.findIndex(c => c.key === key);
        if(idx !== -1) imageColIndices.set(key, idx + 1); // 1-based index
    });

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const rowValues: Record<string, any> = {};
        
        // 格式化数据
        columns.forEach(col => {
            let val = item[col.key];
            if (col.type === 'date' && val) {
                val = formatDateOnly(val);
            } else if (col.type === 'currency' && typeof val === 'number') {
                // val = val; // ExcelJS 可以设置 numFmt，这里直接传数值
            }
            // 如果是图片列，我们先不填文字内容(或者填个占位)，后面会覆盖图片
            if(!imageKeys.includes(col.key)) {
                rowValues[col.key] = val;
            } else {
                rowValues[col.key] = ''; // 图片列留空
            }
        });

        const row = sheet.addRow(rowValues);
        
        // 设置默认行高，如果有图片，后面会加高
        let rowHeight = 24;

        // 3. 处理图片
        if (imageKeys.length > 0) {
            let hasImage = false;
            for (const imgKey of imageKeys) {
                const urls = item[imgKey];
                // 支持单个 URL 字符串或字符串数组
                const urlList = Array.isArray(urls) ? urls : (urls ? [urls] : []);
                
                // 暂时只支持取第一张图
                if (urlList.length > 0) {
                    let firstUrl = urlList[0];
                    if (firstUrl && typeof firstUrl === 'string') {
                        // 处理相对路径
                        if (!firstUrl.startsWith('http') && typeof window !== 'undefined') {
                            firstUrl = `${window.location.origin}${firstUrl.startsWith('/') ? '' : '/'}${firstUrl}`;
                        }

                        try {
                           const imgBuffer = await this.fetchImage(firstUrl);
                           if (imgBuffer) {
                               const imageId = workbook.addImage({
                                   buffer: imgBuffer,
                                   extension: 'png', // 这里的扩展名其实 ExcelJS 会自动识别，但类型定义需要
                               });
                               
                               const colIdx = imageColIndices.get(imgKey);
                               if(colIdx) {
                                   sheet.addImage(imageId, {
                                       tl: { col: colIdx - 1.1, row: row.number - 1.1 } as any, 
                                       br: { col: colIdx - 0.1, row: row.number - 0.1 } as any,
                                       editAs: 'oneCell',
                                   });
                                   hasImage = true;
                               }
                           }
                        } catch (e) {
                            console.error('Add image failed', e);
                        }
                    }
                }
            }
             if (hasImage) {
                rowHeight = 80; // 有图片的行设置高一点
            }
        }
        
        row.height = rowHeight;
        row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }

    // 4. 导出文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  }
}
