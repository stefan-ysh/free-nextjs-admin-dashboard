# Development Roadmap & Milestones

本文档根据需求梳理出后续的开发、优化、重构方向和计划。基于现有的 `DATA_MODEL.md` 和系统功能现状，分为四大模块进行规划。

> 2025-11 更新：原计划中的“报销”模块与采购功能重叠，现仅保留采购审批与结算流程，所有里程碑都已围绕“采购→支付→财务”重新定义。

---

## 里程碑概览

| 里程碑 | 模块 | 优先级 | 预计工期 | 状态 |
|--------|------|--------|----------|------|
| M1 | 项目管理完善 | 高 | 2-3周 | 未开始 |
| M2 | 采购审批与结算自动化 | 高 | 2-3周 | 未开始 |
| M3 | 财务联动服务化 | 高 | 1-2周 | 未开始 |
| M4 | 附件预览功能 | Medium | 1周 | 未开始 |

---

## M1: 项目管理完善

### 当前状态
- ✅ 基础 CRUD 已实现（`/api/projects`），列表页位于 `src/app/(admin)/projects/page.tsx`
- ✅ 统计卡片 + 筛选器：`ProjectStatsCards`, `ProjectFilters`, `ProjectTable` 支持状态/优先级/搜索 + 分页
- ✅ 详情抽屉：`ProjectDrawer` 展示状态、优先级、风险、合同信息、时间线、预算/合同金额、团队成员、附件链接、里程碑列表
- ✅ 权限控制：`PROJECT_VIEW_ALL`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_DELETE`
- ⚠️ 缺少：进度跟踪、预算执行、任务分配、文件关联、阶段管理、财务联动、附件预览

#### 现有实现盘点（代码参考）

| 功能 | 现状 | 代码位置 |
| --- | --- | --- |
| 项目列表 | 支持刷新、分页、过滤、权限提示 | `src/app/(admin)/projects/page.tsx` + `useProjectList`
| 统计概览 | 4 张概览卡片（状态/金额汇总） | `src/components/projects/ProjectStatsCards.tsx` + `/api/projects/stats/*`
| 详情抽屉 | 展示基础信息、时间线、财务字段、团队 ID、附件 URL、里程碑 JSON | `src/components/projects/ProjectDrawer.tsx`
| 新建/编辑 | 表单对话框 + 校验器 | `ProjectFormDialog`, `/api/projects/validators.ts`
| 权限控制 | `usePermissions` 控制创建按钮、列表范围 | `src/hooks/usePermissions.ts` + `Permissions`

#### 缺口分析

1. **进度与状态颗粒度**
  - 当前仅通过 `status` + 里程碑状态展示，缺少自动计算的进度条/燃尽图。
  - 里程碑结构仅包含 `title/status/dueDate/amount`，无 `startedAt`, `completedAt`, `owner` 字段。

2. **预算执行 vs 实际支出**
  - Drawer 中展示 `budget`、`contractAmount`、`actualCost`，但 `actualCost` 由手动维护，未与财务记录联动。
  - 无“预算消耗百分比”“剩余预算”等衍生指标，也无按阶段拆分的费用视图。

3. **团队/任务协作**
  - `teamMemberIds` 仅存 ID 列表，在 UI 中也只以 Badge 形式显示 ID，缺少头像、姓名映射。
  - 没有任务/子项目实体，也无法分配责任人或追踪任务状态。

4. **文件与沟通记录**
  - 附件列表仅显示 URL，缺少名称/类型/预览，未与 `/api/files/[...segments]` 打通。
  - 无交流记录或审批日志，难以审计项目变更历史。

5. **与其他模块的联动**
  - 项目详情未展示关联的采购、库存、财务流水数量。
  - 缺少“从项目维度查看采购/报销/收入”的聚合 API & UI。

6. **数据导出 & 报表**
  - 无法导出项目组合数据（预算 vs 实际、阶段进度），后续 BI/报表需要额外实现。

> 以上缺口会在本里程碑的需求细化与验收标准中逐步覆盖，可作为拆解任务的依据。

### 需求细化
根据"项目管理：根据现在的项目，进行项目管理，需要有一些基本的信息给到"：

1. **补充项目基本信息展示**
   - 当前状态：已有项目名称、编号、负责人、团队成员
   - 需新增字段/视图：
     - 项目进度百分比（基于里程碑完成度计算）
     - 预算执行比例（`actual_cost / budget`）
     - 关联的采购/财务记录数量
     - 项目文档附件列表（利用现有 `attachments` JSON 字段）

2. **里程碑与阶段管理**
   - 将 `milestones` JSON 结构化：
     ```typescript
     interface Milestone {
       id: string;
       name: string;
       startDate?: string;
       endDate?: string;
       status: 'pending' | 'in_progress' | 'completed';
       deliverables?: string[];
     }
     ```
   - 前端展示甘特图或时间线视图
   - API 支持单独更新里程碑状态

3. **预算与成本跟踪**
   - 已有字段：`budget`, `actual_cost`
   - 需关联财务记录：通过 `finance_records.project_id` 汇总实际支出
   - 新增 API：`/api/projects/[id]/financials` 返回项目关联的所有财务流水

4. **任务与团队协作**（可选，Phase 2）
   - 新建子表 `project_tasks` 关联项目和团队成员
   - 包含任务名称、负责人、截止日期、完成状态
   - 支持任务看板视图

5. **项目筛选与搜索增强**
   - 当前已支持按状态、优先级、负责人筛选
   - 新增：按预算范围、开始/结束日期区间、关键字搜索（合同编号、客户名称）

### 技术实现要点
- **前端组件**：
  - `src/components/projects/ProjectDetailView.tsx`：综合展示项目信息
  - `src/components/projects/MilestoneTimeline.tsx`：里程碑时间轴
  - `src/components/projects/BudgetProgressBar.tsx`：预算执行可视化
- **API 扩展**：
  - `GET /api/projects/[id]/financials`：聚合项目相关财务记录
  - `PATCH /api/projects/[id]/milestones`：批量更新里程碑
- **数据库**：无需新增表，充分利用现有 `projects.milestones` JSON 和 `finance_records.project_id` 外键

### 验收标准
- [ ] 项目详情页展示完整的基本信息（负责人、预算、进度、里程碑）
- [ ] 里程碑可单独标记完成，并更新项目整体进度
- [ ] 项目财务汇总页面显示所有关联支出，并与预算对比
- [ ] 支持按预算区间、日期范围筛选项目列表

---

## M2: 采购审批与结算自动化

### 当前状态
- ✅ 采购 CRUD（`/api/purchases`）和基础状态机仍可用
- ❌ 报销页面与 API 已删除，暂时缺少审批入口
- ⚠️ `reimbursement_logs` 表保留但未更名，支付动作仍直接落到财务记录

### 需求细化
目标：将审批、打款、日志完全融合进采购模块，避免“采购 vs 报销”双线流程。

1. **采购审批工作台**
   - 新建 `src/app/(admin)/purchases/approvals/page.tsx` + 对应客户端组件，替代原 `/reimbursements`。
   - 列表加载 `status in ['pending_approval','approved','rejected']`，展示申请人、金额、发票/附件、日志。
   - 支持批量/单条刷新、权限提示（`Permissions.PURCHASE_APPROVE` 才能访问）。

2. **采购详情操作区**
   - “提交审批”“撤回”“标记支付”“驳回”按钮直接挂在采购详情抽屉或表格行动作上。
   - 提交时校验发票：`invoiceType !== 'none'` 时需上传附件或已开票；记录 `submittedAt` 与操作者。

3. **API 子路由**
   - `POST /api/purchases/[id]/submit`：状态 `draft → pending_approval`。
   - `POST /api/purchases/[id]/approve`：标记 `approved`，可附加备注。
   - `POST /api/purchases/[id]/reject`：写入 `rejectionReason` 并退回 `draft`。
   - `POST /api/purchases/[id]/mark-paid`：`approved → paid`，触发财务写入。
   - 统一返回最新记录，前端据此更新列表。

4. **操作日志重命名**
   - 将 `reimbursement_logs` 更名为 `purchase_logs`（或复用原表但字段语义更新），记录动作、操作者、备注。
   - 在审批页和详情侧边实时展示。

5. **通知与权限**
   - 维持 toast 提示，保留后续接入站内通知的扩展点。
   - `PURCHASE_APPROVE` 拥有审批/打款权限；普通用户 `paid` 状态仅可查看。

### 技术实现要点
- **前端**：
  - 采购列表组件扩展操作列；新增 `PurchaseApprovalList`, `PurchaseApprovalActions`。
  - 统一复用 `PurchaseStatusBadge`, `PurchaseLogTimeline`（如需新建）。
- **API / Server Actions**：
  - 在 `src/app/api/purchases/[id]/route.ts` 或 server actions 中拆分四个子路由。
  - 将通用校验抽到 `src/lib/purchases/service.ts`，便于复用。
- **数据库**：
  - 迁移脚本：表重命名、字段新增（`submitted_at`, `approved_at`, `paid_at`, `rejection_reason`）。

### 验收标准
- [ ] `/purchases/approvals` 能列出待审批记录并执行批准/驳回操作。
- [ ] 采购详情按钮可提交审批/标记支付，状态流转一次只走一条线。
- [ ] `paid` 状态禁止编辑/删除，驳回状态可再次提交。
- [ ] 每次操作都写入 `purchase_logs` 并在前端展示。

---

## M3: 财务联动服务化

### 当前状态
- ✅ `finance_records` 已支持 `sourceType`、`purchase_id`/`project_id` 外键
- ❌ 缺少统一的 service 层与状态字段；库存/项目动作未与财务联动

### 需求细化
围绕“采购即流程”的新策略，将所有自动写入统一到一个可测试的服务层。

1. **Finance Automation Service**
  - 新建 `src/lib/services/finance-automation.ts`，导出：
    - `createPurchaseExpense(purchase, operator)`
    - `createSaleIncome(movement, operator)`
    - `createProjectIncome(projectPayment, operator)`
  - 所有函数负责：幂等校验、金额计算、`finance_records` 写入、返回记录 ID。

2. **Schema 迁移**
  - `finance_records` 新增 `status`(`draft` | `cleared`)、`source_type` 枚举扩展（新增 `inventory`, `project_payment`）。
  - 视需求新增 `inventory_movement_id`、`project_payment_id` 外键或复用 `metadata` JSON。
  - 更新 `src/lib/schema/finance.ts` 与 DAO。

3. **API 改造**
  - 采购打款：`POST /api/purchases/[id]/mark-paid` 内调用 `createPurchaseExpense`。
  - 库存：`POST /api/inventory/outbound` 当 `type='sale'` 时调用 `createSaleIncome`，默认 `status='draft'`，待财务确认时置 `cleared`。
  - 项目：新增 `POST /api/projects/[id]/payments`，创建分期收款并调用 `createProjectIncome`。

4. **前端配合**
  - 财务列表（`FinanceTable`）增加 `sourceType`、`status` 筛选与徽标。
  - 采购/项目详情展示“关联财务流水”嵌套列表（透传查询参数）。

### 验收标准
- [ ] `finance-automation` 服务可被采购/库存/项目复用，并具备单元测试。
- [ ] `finance_records` 支持 `status` 与新的 `sourceType`，并可通过迁移脚本下发。
- [ ] 打款/出库/收款都会自动生成或更新财务记录，失败时具备回滚策略。
- [ ] 财务列表与详情页能按来源与状态过滤记录。

---

## M4: 附件预览功能

### 当前状态
- ✅ 文件上传：`/api/files/upload` 存储到 `public/uploads`
- ✅ 文件访问：`/api/files/[...segments]` 返回文件流
- ⚠️ 缺少：前端预览组件，支持多种文件类型

### 需求细化
根据"现在上传的附件不支持查看预览，优化此处"：

1. **支持的文件类型**
   - **图片**：`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
   - **PDF**：`.pdf`
   - **文档**（可选）：`.docx`, `.xlsx`（需第三方库或仅提供下载）
   - **视频**（可选）：`.mp4`, `.webm`

2. **预览组件设计**
   - 创建 `src/components/common/FilePreview.tsx`：
     - Props: `url: string`, `fileName?: string`, `mimeType?: string`
     - 根据文件扩展名或 MIME 类型选择渲染方式：
       - 图片：`<img>` 或 `next/image`
       - PDF：使用 `react-pdf` 或嵌入 `<iframe>`/`<object>`
       - 视频：`<video>` 标签
       - 其他：显示文件名 + 下载按钮
   - 支持弹窗模式（Modal）和内联模式

3. **集成到现有模块**
   - **采购管理**：
     - `invoice_images`, `receipt_images`, `attachments` 字段
     - 在详情页/表单页显示缩略图，点击打开预览
   - **财务管理**：
     - `invoice.attachments` 字段
     - 列表页显示附件数量图标，详情页预览
   - **项目管理**：
     - `attachments` 字段
     - 项目详情页展示文档列表 + 预览

4. **PDF 预览技术选型**
   - 方案 A：`react-pdf` + `pdfjs-dist`
     - 优点：完全客户端渲染，支持分页、缩放
     - 缺点：Bundle 体积较大
   - 方案 B：浏览器原生 `<embed>` 或 `<object>`
     - 优点：轻量，兼容性好
     - 缺点：移动端支持有限
   - **推荐**：先用方案 B 快速实现，后续按需引入 `react-pdf`

5. **文件元数据存储**
   - 当前附件存储为 URL 字符串数组
   - 可扩展为对象数组（可选）：
     ```typescript
     interface Attachment {
       url: string;
       name: string;
       size: number;
       mimeType: string;
       uploadedAt: string;
     }
     ```
   - 兼容性：保持向后兼容，支持字符串数组自动转换

### 技术实现要点
- **前端组件**：
  - `src/components/common/FilePreview.tsx`：预览组件
  - `src/components/common/FilePreviewModal.tsx`：弹窗封装
  - `src/components/common/AttachmentList.tsx`：附件列表 + 预览触发
- **工具函数**：
  - `src/lib/utils.ts` 新增 `getFileMimeType(url: string): string`
  - `src/lib/utils.ts` 新增 `isPreviewableFile(url: string): boolean`
- **依赖安装**（可选）：
  ```bash
  npm install react-pdf pdfjs-dist
  ```
- **文档更新**：
  - `docs/LOCAL_STORAGE_SETUP.md`：补充支持的文件类型和限制

### 验收标准
- [ ] 图片附件可在模态框中预览，支持缩放
- [ ] PDF 附件可内嵌预览（至少在桌面浏览器）
- [ ] 不支持预览的文件显示下载按钮
- [ ] 采购、财务、项目模块的附件均可预览
- [ ] 移动端兼容性良好（至少支持下载）

---

## 开发优先级建议

1. **Phase 1（高优先级）**：
   - M2: 采购报销流程自动化（直接影响业务流程）
   - M3: 财务记录自动化集成（减少手动录入）

2. **Phase 2（中优先级）**：
   - M1: 项目管理完善（提升项目可视化）
   - M4: 附件预览功能（改善用户体验）

3. **Phase 3（优化阶段）**：
   - 通知系统（邮件/站内信）
   - 权限精细化（行级权限、数据隔离）
   - 报表与数据导出（Excel、PDF）
   - 移动端适配与响应式优化

---

## 技术债务与重构计划

1. **Schema 版本管理**
   - 当前：`ensureColumn` 等热补丁方式
   - 目标：引入 Prisma 或 Drizzle 统一管理迁移
   - 时间：可在 Phase 2 启动

2. **API 类型安全**
   - 当前：部分 API 使用 `unknown` 或弱类型
   - 目标：全面采用 Zod schema + tRPC（可选）
   - 时间：渐进式重构，从新模块开始

3. **前端状态管理**
   - 当前：Context + useState 混合
   - 目标：统一使用 Zustand 或 TanStack Query
   - 时间：Phase 3 优化阶段

4. **测试覆盖**
   - 当前：缺少单元测试和集成测试
   - 目标：关键业务逻辑覆盖率 > 60%
   - 工具：Vitest + Testing Library
   - 时间：从 M2、M3 开始同步编写测试

---

## 文档维护

随着开发推进，需同步更新以下文档：

- `DATA_MODEL.md`：新增表或字段时更新
- `DEV_STATUS.md`：每个里程碑完成后补充状态
- `FINANCE_MODULE.md` / `INVENTORY_MODULE.md`：模块专项文档
- `LOCAL_STORAGE_SETUP.md`：附件处理变更时更新
- **新增**：`API_DOCUMENTATION.md`（OpenAPI / Swagger 规范）

---

## 总结

本路线图将四大需求模块化为可执行的里程碑，明确了技术实现路径和验收标准。建议按 M2 → M3 → M1 → M4 的顺序推进，优先解决业务流程自动化，再完善辅助功能。每个里程碑结束后需更新 `DEV_STATUS.md` 并进行集成测试。
