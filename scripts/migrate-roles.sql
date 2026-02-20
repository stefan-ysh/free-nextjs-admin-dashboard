-- 角色系统迁移脚本
-- 将 'finance' 角色用户迁移为 'approver' 角色
-- ⚠️ 请在执行前做好数据库备份

-- 1. 迁移 primary_role
UPDATE hr_employees SET primary_role = 'approver' WHERE primary_role = 'finance';
UPDATE hr_employees SET primary_role = 'approver' WHERE primary_role = 'admin';
UPDATE hr_employees SET primary_role = 'approver' WHERE primary_role = 'finance_admin';

-- 2. 迁移 roles JSON 数组中的角色
UPDATE hr_employees SET roles = REPLACE(roles, '"finance"', '"approver"') WHERE roles LIKE '%"finance"%' AND roles NOT LIKE '%"finance_school"%' AND roles NOT LIKE '%"finance_company"%' AND roles NOT LIKE '%"finance_director"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"admin"', '"approver"') WHERE roles LIKE '%"admin"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"finance_admin"', '"approver"') WHERE roles LIKE '%"finance_admin"%';

-- 注意：如果 roles 中同时包含 "finance" 和 "finance_school"/"finance_company"，
-- 上面的条件会跳过。如果存在这种情况，需要手动处理：
-- UPDATE hr_employees SET roles = REPLACE(roles, '"finance",', '"approver",') WHERE roles LIKE '%"finance"%';

-- 3. 清理已删除的角色（如果有用户还持有这些角色）
UPDATE hr_employees SET primary_role = 'employee' WHERE primary_role IN ('hr', 'department_manager', 'inventory_manager', 'inventory_operator', 'auditor', 'staff');
UPDATE hr_employees SET roles = REPLACE(roles, '"hr"', '"employee"') WHERE roles LIKE '%"hr"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"department_manager"', '"employee"') WHERE roles LIKE '%"department_manager"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"inventory_manager"', '"employee"') WHERE roles LIKE '%"inventory_manager"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"inventory_operator"', '"employee"') WHERE roles LIKE '%"inventory_operator"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"auditor"', '"employee"') WHERE roles LIKE '%"auditor"%';
UPDATE hr_employees SET roles = REPLACE(roles, '"staff"', '"employee"') WHERE roles LIKE '%"staff"%';

-- 4. 验证迁移结果
SELECT primary_role, COUNT(*) AS user_count FROM hr_employees GROUP BY primary_role ORDER BY user_count DESC;
