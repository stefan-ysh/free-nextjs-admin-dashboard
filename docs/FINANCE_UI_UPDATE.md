# 财务管理功能UI更新说明

## 更新内容 (2024)

本次更新根据业务需求对财务管理模块进行了全面优化:

### 1. ✅ 移除PRO广告
- **位置**: `src/layout/SidebarWidget.tsx`
- **更改**: 移除了侧边栏底部的"升级到PRO"广告组件,返回null
- **原因**: 去除商业化推广,更适合企业内部使用

### 2. ✅ 自定义日期选择器
- **新增组件**: `src/components/ui/DatePicker.tsx`
- **特性**:
  - 完全自定义的日历UI,与项目设计风格一致
  - 支持深色模式切换
  - 中文本地化(周、月显示)
  - 点击外部自动关闭
  - "今天"快捷按钮
  - 可视化选中状态和今日标识
- **使用位置**:
  - 财务记录日期选择
  - 发票开票日期选择

### 3. ✅ 发票附件上传
- **复用组件**: `src/components/common/FileUpload.tsx`
- **功能**:
  - 拖拽上传支持
  - 文件预览(图片和PDF)
  - 最多5个文件
  - 可删除已上传文件
  - 支持格式: PNG, JPG, JPEG, PDF
- **集成**:
  - 当发票状态选择"已开票"时,自动显示上传区域
  - 附件存储在`invoice.attachments`字段

### 4. ✅ 更新业务分类
- **位置**: `src/lib/db/finance.ts` - `getCategories()`
- **新增分类**:
  - **收入**: 收入、资金注入、银行公户办理相关、其他收入
  - **支出**: 装修费用、交通费、餐费、团建、发放工资、设备购买、银行公户办理相关、材料费、服务费、报销、办公用品、其他支出

### 5. ✅ 优化表格显示
- **位置**: `src/components/finance/FinanceTable.tsx`
- **新增字段列**:
  - 明细名称 (加粗显示,截断过长文本)
  - 合同金额 (独立显示)
  - 手续费 (灰色显示)
  - 总金额 (醒目显示,收入绿色、支出红色)
  - 款项类型 (定金/全款/分期/尾款/其他)
  - 发票状态 (已开票绿色、待开票黄色、带附件数量图标📎)
- **移除字段**:
  - 旧的单一"金额"列
  - "描述"列(简化视图)

## 数据结构

### FinanceRecord 字段说明

```typescript
{
  // 基本信息
  name: string;          // 明细名称(如:办公室装修)
  date: string;          // 交易日期
  category: string;      // 分类(如:装修费用)
  type: TransactionType; // 收入/支出
  
  // 金额字段(关键变更)
  contractAmount: number;  // 合同金额
  fee: number;            // 手续费
  totalAmount: number;    // 总金额(自动计算 = contractAmount + fee)
  
  // 款项信息
  paymentType: PaymentType; // 定金/全款/分期/尾款/其他
  
  // 发票信息
  invoice?: {
    type: InvoiceType;       // 专票/普票/无需发票
    status: InvoiceStatus;   // 已开票/待开票/无需开票
    number?: string;         // 发票号码
    issueDate?: string;      // 开票日期
    attachments?: string[];  // 附件URL数组
  };
  
  // 其他
  description?: string;      // 备注
}
```

## 表单字段映射

| UI标签 | 字段名 | 类型 | 必填 | 说明 |
|--------|--------|------|------|------|
| 明细名称 | name | string | ✅ | 如:办公室装修、员工工资 |
| 收支类型 | type | enum | ✅ | 收入/支出 |
| 分类 | category | string | ✅ | 下拉选择,根据type动态加载 |
| 合同金额 | contractAmount | number | ✅ | 单位:元 |
| 手续费 | fee | number | ✅ | 单位:元 |
| 总金额 | totalAmount | number | ❌ | 自动计算,只读显示 |
| 款项类型 | paymentType | enum | ✅ | 定金/全款/分期/尾款/其他 |
| 日期 | date | string | ✅ | 自定义DatePicker组件 |
| 发票类型 | invoice.type | enum | ❌ | 专票/普票/无需发票 |
| 开票状态 | invoice.status | enum | ❌ | 待开票/已开票 |
| 发票号码 | invoice.number | string | ❌ | 仅当状态=已开票时显示 |
| 开票日期 | invoice.issueDate | string | ❌ | 仅当状态=已开票时显示 |
| 发票附件 | invoice.attachments | string[] | ❌ | 仅当状态=已开票时显示 |
| 备注 | description | string | ❌ | 多行文本 |

## 视觉优化

### 表格样式
- **名称列**: `max-w-[200px]` 截断,鼠标悬停显示完整文本
- **金额列**: 
  - 合同金额: 正常粗体黑色
  - 手续费: 灰色
  - 总金额: 特大号粗体,收入绿色/支出红色
- **类型/状态**: 圆角徽章样式,颜色区分
- **发票附件**: 📎 图标 + 数量,悬停显示"X个附件"

### 深色模式支持
- 所有组件完全支持深色模式
- DatePicker日历面板适配暗色背景
- 表格行悬停效果在深色模式下正常工作

## 使用示例

### 添加财务记录

```typescript
// 示例:支付办公室装修款
{
  name: "办公室装修",
  type: TransactionType.EXPENSE,
  category: "装修费用",
  contractAmount: 50000,  // 合同金额5万
  fee: 500,              // 手续费500
  // totalAmount会自动计算为50500
  paymentType: PaymentType.DEPOSIT, // 支付定金
  date: "2024-01-15",
  invoice: {
    type: InvoiceType.SPECIAL,      // 增值税专用发票
    status: InvoiceStatus.ISSUED,   // 已开票
    number: "12345678",
    issueDate: "2024-01-16",
    attachments: ["url1.pdf", "url2.jpg"]
  },
  description: "一层大厅装修工程"
}
```

### 查询统计

统计数据自动使用`totalAmount`计算:
- 总收入 = 所有收入记录的totalAmount之和
- 总支出 = 所有支出记录的totalAmount之和
- 净收支 = 总收入 - 总支出

## 后续优化建议

1. **文件存储**: 将`FileUpload`组件改为调用 `/api/files/upload` 或自建对象存储，避免在前端持有 base64
2. **批量操作**: 添加批量删除、批量导出功能
3. **高级筛选**: 按款项类型、发票状态筛选
4. **数据导出**: 导出Excel功能,包含所有字段
5. **权限控制**: 添加用户权限管理(查看/编辑/删除)
6. **审计日志**: 记录所有操作历史

## 迁移指南

如果之前有使用旧版本的`amount`字段:

```typescript
// 旧版本
{ amount: 50500 }

// 新版本
{
  contractAmount: 50000,
  fee: 500,
  totalAmount: 50500  // 自动计算
}
```

后端API会在创建/更新时自动计算`totalAmount`,前端无需手动设置。

## 技术栈

- **Next.js 15**: App Router + Server Components
- **TypeScript**: 完整类型安全
- **Tailwind CSS V4**: 响应式设计
- **MySQL + 本地存储**: 财务数据写入 MySQL, 附件保存在 `LOCAL_STORAGE_ROOT`
- **自定义组件**: DatePicker, FileUpload(通用组件)

## 相关文件

```
src/
├── components/
│   ├── finance/
│   │   ├── FinanceForm.tsx       # 表单(已更新)
│   │   ├── FinanceTable.tsx      # 表格(已更新)
│   │   ├── FileUpload.tsx        # 文件上传(新增)
│   │   └── FinanceStatsCards.tsx # 统计卡片
│   └── ui/
│       └── DatePicker.tsx        # 日期选择器(新增)
├── types/
│   └── finance.ts                # 类型定义(已更新)
├── lib/
│   └── db/
│       └── finance.ts            # 数据库操作(已更新)
└── layout/
    └── SidebarWidget.tsx         # 侧边栏挂件(已移除广告)
```
