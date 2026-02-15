-- ================================================================
-- 用户表合并迁移脚本
-- 功能：将 auth_users 表迁移到 users 表
-- 执行前请确保已备份数据库！
-- ================================================================

-- ============================================================
-- 第 1 步：备份现有数据（重要！）
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_users_backup AS SELECT * FROM auth_users;
CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;

SELECT 'Backup completed' AS status;

-- ============================================================
-- 第 2 步：审计数据
-- ============================================================
-- 查看各表记录数
SELECT 
    'auth_users' AS table_name,
    COUNT(*) AS record_count
FROM auth_users
UNION ALL
SELECT 
    'users' AS table_name,
    COUNT(*) AS record_count
FROM users;

-- 查看重复记录（同一email在两个表都存在）
SELECT 
    '重复记录数' AS description,
    COUNT(*) AS count
FROM auth_users a
INNER JOIN users u ON a.email = u.email;

-- 查看auth_users中独有的记录
SELECT 
    'auth_users独有记录数' AS description,
    COUNT(*) AS count
FROM auth_users a
LEFT JOIN users u ON a.email = u.email
WHERE u.email IS NULL;

-- ============================================================
-- 第 3 步：数据迁移
-- ============================================================

-- 3.1 迁移 auth_users 中独有的记录到 users
INSERT INTO users (
    id, 
    email, 
    password_hash,
    roles, 
    primary_role,
    first_name, 
    last_name, 
    display_name,
    phone, 
    job_title, 
    bio,
    city, 
    country, 
    postal_code, 
    tax_id,
    social_links,
    custom_fields,
    password_updated_at,
    is_active, 
    email_verified,
    created_at, 
    updated_at,
    created_by,
    employee_code,
    employment_status
)
SELECT 
    a.id,
    a.email,
    a.password_hash,
    JSON_ARRAY(a.role) as roles,  -- 转换单角色为数组
    a.role as primary_role,
    a.first_name,
    a.last_name,
    COALESCE(a.display_name, SUBSTRING_INDEX(a.email, '@', 1)) as display_name,
    a.phone,
    a.job_title,
    a.bio,
    a.city,
    a.country,
    a.postal_code,
    a.tax_id,
    a.social_links,
    JSON_OBJECT() as custom_fields,  -- 空对象
    a.password_updated_at,
    1 as is_active,  -- 默认激活
    0 as email_verified,  -- 默认未验证
    a.created_at,
    a.updated_at,
    NULL as created_by,  -- 没有创建者信息
    NULL as employee_code,  -- 没有员工编码
    NULL as employment_status  -- 没有雇佣状态
FROM auth_users a
LEFT JOIN users u ON a.email = u.email
WHERE u.email IS NULL;  -- 只迁移 users 表中不存在的记录

SELECT 
    '迁移完成' AS status,
    ROW_COUNT() AS migrated_records;

-- 3.2 更新 users 表中已存在的记录（确保密码和认证信息是最新的）
UPDATE users u
INNER JOIN auth_users a ON u.email = a.email
SET 
    -- 如果 users 表中密码为空，使用 auth_users 的密码
    u.password_hash = CASE 
        WHEN u.password_hash IS NULL OR u.password_hash = '' 
        THEN a.password_hash 
        ELSE u.password_hash 
    END,
    -- 更新密码更新时间
    u.password_updated_at = CASE
        WHEN u.password_updated_at IS NULL
        THEN a.password_updated_at
        ELSE GREATEST(u.password_updated_at, COALESCE(a.password_updated_at, u.password_updated_at))
    END,
    -- 同步基本信息（如果 users 表中为空）
    u.first_name = COALESCE(u.first_name, a.first_name),
    u.last_name = COALESCE(u.last_name, a.last_name),
    u.phone = COALESCE(u.phone, a.phone),
    u.bio = COALESCE(u.bio, a.bio),
    u.city = COALESCE(u.city, a.city),
    u.country = COALESCE(u.country, a.country),
    u.postal_code = COALESCE(u.postal_code, a.postal_code),
    u.tax_id = COALESCE(u.tax_id, a.tax_id)
WHERE 
    u.password_hash IS NULL 
    OR u.password_hash = ''
    OR u.first_name IS NULL
    OR u.last_name IS NULL;

SELECT 
    '同步完成' AS status,
    ROW_COUNT() AS updated_records;

-- ============================================================
-- 第 4 步：更新会话表外键
-- ============================================================

-- 4.1 检查 auth_sessions 表中是否有引用不存在于 users 表的记录
SELECT 
    '孤立会话记录' AS description,
    COUNT(*) AS count
FROM auth_sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- 4.2 删除孤立的会话记录（如果有）
DELETE s FROM auth_sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- 4.3 删除旧的外键约束
-- 注意：约束名称可能不同，请先运行 SHOW CREATE TABLE auth_sessions; 查看实际的约束名
SET FOREIGN_KEY_CHECKS = 0;

-- 尝试删除外键（如果报错说不存在，可以忽略该错误或注释掉这行）
ALTER TABLE auth_sessions DROP FOREIGN KEY fk_auth_sessions_user;

-- 4.4 添加新的外键约束（指向 users 表）
ALTER TABLE auth_sessions 
ADD CONSTRAINT fk_auth_sessions_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '外键更新完成' AS status;

-- ============================================================
-- 第 5 步：验证数据完整性
-- ============================================================

-- 验证所有会话都有有效的用户引用
SELECT 
    '会话-用户关联验证' AS check_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '通过 ✓' 
        ELSE CONCAT('失败 - 发现 ', COUNT(*), ' 条孤立记录') 
    END AS result
FROM auth_sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- 验证所有auth_users的数据都已迁移或同步
SELECT 
    'auth_users数据迁移验证' AS check_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '通过 ✓ - 所有记录都已在users表中' 
        ELSE CONCAT('警告 - ', COUNT(*), ' 条记录未找到') 
    END AS result
FROM auth_users a
LEFT JOIN users u ON a.email = u.email
WHERE u.email IS NULL;

-- 显示最终统计
SELECT 
    'users表记录总数' AS description,
    COUNT(*) AS count
FROM users;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '
=============================================================
迁移完成！

下一步：
1. 检查上述验证结果，确保所有检查都 "通过 ✓"
2. 测试登录功能是否正常
3. 测试用户创建功能是否正常
4. 确认系统运行稳定后，可以：
   - 部署代码更新（使用 users 表的新代码）
   - 等待一段时间后删除 auth_users 表
   
备份表保留位置：
- auth_users_backup
- users_backup

如需回滚，运行 migration_rollback.sql
=============================================================
' AS message;
