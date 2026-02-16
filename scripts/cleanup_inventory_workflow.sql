-- 数据清洗脚本（库存目录 + 角色流程）
-- 执行前建议先备份数据库。
-- 适配当前项目角色模型：super_admin / finance / finance_school / finance_company / employee

SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

/* 1) 清洗库存物品基础字段 */
UPDATE inventory_items
SET
  name = TRIM(name),
  unit = TRIM(unit),
  category = TRIM(category),
  barcode = NULLIF(TRIM(COALESCE(barcode, '')), ''),
  unit_price = IF(unit_price < 0, 0, unit_price),
  safety_stock = IF(safety_stock < 0, 0, safety_stock)
WHERE is_deleted = 0;

/* 2) 分类归一化（与前端目录一致） */
UPDATE inventory_items
SET category = CASE
  WHEN LOWER(category) IN ('chemicals', 'reagents', 'chemical reagent', 'chemical reagents', '化学药品', '生化试剂') THEN '化学试剂'
  WHEN LOWER(category) IN ('consumables', 'glassware', 'lab consumables', '实验用品') THEN '实验耗材'
  WHEN LOWER(category) IN ('raw materials', 'raw material', 'material', 'materials') THEN '原材料'
  WHEN LOWER(category) IN ('semi', 'semi-finished', 'semi finished') THEN '半成品'
  WHEN LOWER(category) IN ('finished') THEN '成品'
  WHEN LOWER(category) IN ('accessory', 'accessories') THEN '配件'
  WHEN LOWER(category) IN ('equipment', 'devices') THEN '仪器设备'
  WHEN LOWER(category) IN ('tools', 'tool') THEN '工具器具'
  WHEN LOWER(category) IN ('office', 'stationery', '办公文具') THEN '办公用品'
  WHEN LOWER(category) IN ('safety', 'safety supplies') THEN '劳保防护'
  WHEN LOWER(category) IN ('testing', 'test') THEN '检测样品'
  WHEN LOWER(category) IN ('pantry', 'kitchen') THEN '生活物资'
  WHEN LOWER(category) IN ('service', 'services') THEN '服务费用'
  WHEN LOWER(category) IN ('other', 'others', 'misc', '') THEN '未分类'
  ELSE category
END
WHERE is_deleted = 0;

/* 3) 角色收敛（严格模式：仅保留一个主角色） */
UPDATE hr_employees
SET primary_role = CASE
  WHEN primary_role = 'super_admin' THEN 'super_admin'
  WHEN primary_role IN ('finance', 'admin') THEN 'finance'
  WHEN primary_role = 'finance_school' THEN 'finance_school'
  WHEN primary_role = 'finance_company' THEN 'finance_company'
  ELSE 'employee'
END;

UPDATE hr_employees
SET roles = JSON_ARRAY(primary_role);

/* 4) 清理待审批指派（只允许审批管理员） */
UPDATE purchases p
LEFT JOIN hr_employees e ON e.id = p.pending_approver_id
SET p.pending_approver_id = NULL,
    p.workflow_step_index = NULL
WHERE p.is_deleted = 0
  AND p.status = 'pending_approval'
  AND p.pending_approver_id IS NOT NULL
  AND (
    e.id IS NULL
    OR NOT (
      e.primary_role = 'finance'
      OR JSON_CONTAINS(COALESCE(e.roles, JSON_ARRAY()), JSON_QUOTE('finance'), '$')
    )
  );

COMMIT;

-- 如需回滚本次脚本，可在 COMMIT 前改成 ROLLBACK;
