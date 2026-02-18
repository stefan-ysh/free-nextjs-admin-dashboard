# 财务管理模块 - 开发环境说明

## ✅ 构建状态

**所有功能已成功实现并运行!**

- ✅ 服务器成功启动在 `http://localhost:3000`
- ✅ 财务管理页面可访问: `/finance`
- ✅ 本地 MySQL 连接正常，自动建表已通过
- ✅ 所有API端点正常响应
- ✅ UI组件完整加载

## 🎯 已实现功能

### 1. 移除PRO广告 ✅
- `SidebarWidget.tsx` 已修改为返回null

### 2. 自定义日期选择器 ✅
- 新建 `DatePicker.tsx` 组件
- 完整的日历UI,支持深色模式
- 已集成到财务表单的两个日期字段

### 3. 发票附件上传 ✅
- 新建 `FileUpload.tsx` 组件
- 拖拽上传,文件预览,删除功能
- 仅在"已开票"状态显示

### 4. 更新业务分类 ✅
- 支出分类: 装修费用、交通费、餐费、团建、发放工资等
- 收入分类: 收入、资金注入、银行公户办理相关等

### 5. 优化表格显示 ✅
- 新增列: 明细名称、合同金额、手续费、总金额、款项类型、发票状态
- 发票附件数量图标显示
- 响应式设计,支持深色模式

### 6. 采购审批工作台 ✅
- `/purchases/approvals` 页面重新上线，聚合所有 `pending_approval` 采购单
- 新增 `/api/purchases/approvals` 列表接口与 `/api/purchases/[id]/workflow-handler` 共用校验逻辑
- UI 文案替换“报销”为“采购”，与权限 (`PURCHASE_APPROVE/REJECT/PAY`) 打通
- 采购侧边栏新增“采购审批”子菜单，便于审批角色快速入口

### 7. 财务自动化服务(首阶段) ✅
- 新建 `src/lib/services/finance-automation.ts`，并在打款流程中调用 `createPurchaseExpense`
- `finance_records` 表新增 `status(draft|cleared)`、`metadata_json` 字段，`source_type` 扩展 `inventory/project_payment`
- 所有 Finance DAO/类型/校验已同步新增字段，API 创建记录时默认 `status='draft'`
- 采购打款会将流水记为 `sourceType=purchase`、`status=cleared`，并记录 `purchaseNumber/purchaserId/payedBy` 等 metadata

### 8. 供应商基础数据 ✅
- `ensureSuppliersSchema` 会在首次初始化时自动写入「淘宝 / 拼多多 / 京东 / 1688」四个常用电商平台
- 默认标记为 `active` 状态，管理员仍可在后台供应商页面继续新增或编辑其它供应商

## 🔧 本地数据库模式

- MySQL: `finance_records / finance_categories / purchases / auth_users / reimbursement_logs` 已通过 `ensure*Schema` 自动创建
- 附件: 写入 `LOCAL_STORAGE_ROOT` (默认 `~/Documents/admin_cosmorigin-storage`)

> 若数据库不可用,API 会抛出 `ECONNREFUSED` 或 `ER_NO_SUCH_TABLE`,请先确认 `.env.local` 与服务状态。

## 🚀 测试功能

访问 `http://localhost:3000/finance` 可以:

1. **查看记录列表**
   - 默认展示数据库中的最新记录
   - 可验证所有字段(合同金额、手续费、总金额、发票状态等)

2. **预算调整**
   - 点击"预算调整"按钮
   - 填写预算调整表单并保存
   - 自动同步生成收支流水

3. **编辑预算调整**
   - 点击预算调整对应的流水记录“编辑”
   - 使用同一预算调整表单更新

4. **删除记录**
   - 点击"删除"按钮确认删除，同时删除本地附件

5. **查看统计**
   - 页面顶部显示总收入、总支出、净收支、记录数

## 📊 数据结构

### 金额字段
- `contractAmount`: 合同金额(独立字段)
- `fee`: 手续费(独立字段)
- `totalAmount`: 总金额(自动计算 = contractAmount + fee)

### 发票信息
```typescript
invoice: {
  type: 'special' | 'general' | 'none',
  status: 'issued' | 'pending' | 'not_required',
  number?: string,
  issueDate?: string,
  attachments?: string[]  // 文件URL数组
}
```

## 🔄 部署建议

1. 按照 `.env.example` 配置本地/服务器上的数据库连接
2. 运行 `npm run build && npm run start` 或参考 [docs/DEPLOYMENT.md](./DEPLOYMENT.md)
3. 通过备份脚本定期导出 MySQL 与 `LOCAL_STORAGE_ROOT`

## ⚠️ VS Code错误提示

如果VS Code显示以下错误,可以忽略(是缓存问题):
```
Cannot find module '@/components/finance/FinanceForm'
```

**实际情况**:
- ✅ 文件存在且语法正确
- ✅ Next.js成功编译
- ✅ 页面正常运行
- ✅ 所有功能可用

### 解决方法
1. 重启VS Code TypeScript服务器: `Cmd+Shift+P` → `TypeScript: Restart TS Server`
2. 或直接忽略,不影响功能

## 📝 API端点

```
GET    /api/finance/records          # 获取记录列表
POST   /api/finance/records          # 创建记录
GET    /api/finance/records/[id]     # 获取单条记录
PATCH  /api/finance/records/[id]     # 更新记录
DELETE /api/finance/records/[id]     # 删除记录
GET    /api/finance/stats            # 获取统计数据
GET    /api/finance/categories       # 获取分类列表
```

## 🎨 UI组件

- `DatePicker`: 自定义日历选择器
- `FileUpload`: 拖拽文件上传组件
- `FinanceForm`: 完整表单(集成DatePicker和FileUpload)
- `FinanceTable`: 优化的数据表格
- `FinanceStatsCards`: 统计卡片

所有组件完全支持深色模式!

## 🐛 已知问题

1. **Next.js 15警告** - ✅ 已修复
   - 问题: `params` should be awaited
   - 修复: 更新API路由参数类型为`Promise<{ id: string }>`

2. **文件上传** - 需要优化
   - 当前: 前端暂存 base64，再由 API 写入 `LOCAL_STORAGE_ROOT`
   - 建议: 直接走流式上传接口，或接入自建对象存储

## 📚 相关文档

- `docs/FINANCE_MODULE.md` - 模块功能说明
- `docs/FINANCE_UI_UPDATE.md` - UI更新详情
- `docs/LOCAL_STORAGE_SETUP.md` - 本地文件目录配置
- `docs/DEPLOYMENT.md` - 本地/自托管部署指南

---

**开发测试**: 访问 http://localhost:3000/finance 查看所有功能!
