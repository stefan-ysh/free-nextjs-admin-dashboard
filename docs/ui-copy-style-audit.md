# 文案与组件风格巡检（第一轮）

更新日期：2026-02-15
范围：后台主流程页（采购、财务、进销存、组织、工作台、个人中心）

## 总体结论
- 文案主语言已基本统一为中文。
- 组件风格存在“并行风格”问题：同类场景仍混用 `alert-box`、`panel-frame`、`surface-card`，影响一致性。
- 权限提示文案语气和信息密度不统一，建议收敛成统一模板。

## 高优先级问题（P0）

1. 页面权限提示模板不统一，影响可理解性
- 涉及文件：
`src/app/(admin)/finance/payments/page.tsx`
`src/app/(admin)/inventory/items/page.tsx`
`src/components/employees/EmployeeClient.tsx`
- 现象：有的提示“无权访问”，有的提示“请联系管理员开通 XXX 权限”，粒度不一致。
- 建议模板：
  - 标题：`无访问权限`
  - 正文：`当前账户缺少 {PERMISSION_NAME}，请联系管理员开通。`
  - 组件：统一使用 `DataState variant="error"`。

## 中优先级问题（P1）

1. 页面容器样式混用
- 涉及文件：
`src/app/(admin)/purchases/page.tsx`
`src/app/(admin)/inventory/movements/page.tsx`
`src/app/(admin)/finance/payments/page.tsx`
- 现象：同类信息态混用 `panel-frame`、`surface-panel`、`alert-box`。
- 建议：
  - 信息态统一用 `DataState`。
  - 业务卡片统一 `surface-card`。
  - 工具栏统一 `surface-toolbar`。

2. 标题层级不统一
- 涉及文件：
`src/app/(admin)/inventory/items/page.tsx`
`src/app/(admin)/workflow/todo/page.tsx`（由子组件渲染）
- 现象：主页面存在 `h1`/`h2` 混用。
- 建议：
  - 页面主标题一律 `h1`。
  - 分区标题一律 `h2`。
  - 表格/卡片内部标题用 `text-sm font-semibold`。

## 低优先级问题（P2）

1. 占位文案尚未产品化
- 文件：`src/app/(admin)/inventory/movements/page.tsx`
- 现象：`CSV 导出功能将于下一阶段提供` 使用 `alert`。
- 建议：替换为按钮禁用态 + tooltip（`即将上线`），避免阻断式弹窗。

2. 已删除路由残留模块未清理
- 路由已删除：`/calendar`、`/form-elements`
- 残留代码：
`src/components/calendar/Calendar.tsx`
`src/app/api/calendar/events/route.ts`
`src/app/api/calendar/events/[id]/route.ts`
- 建议：若确认不再启用日程模块，进入二次清理（代码 + 依赖）。

## 执行顺序建议
1. 先修 P0（权限提示文案模板统一）
2. 再做 P1（统一提示文案模板、容器组件）
3. 最后做 P2（占位文案产品化、残留模块清理）
