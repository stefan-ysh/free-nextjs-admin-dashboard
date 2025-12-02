-- ================================================================
-- 用户表合并回滚脚本
-- 功能：如果迁移出现问题，使用此脚本回滚到迁移前状态
-- 警告：仅在迁移失败或出现严重问题时使用！
-- ================================================================

-- 检查备份表是否存在
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_users_backup')
        THEN '✓ auth_users_backup 存在'
        ELSE '✗ auth_users_backup 不存在 - 无法回滚'
    END AS backup_status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_backup')
        THEN '✓ users_backup 存在'
        ELSE '✗ users_backup 不存在 - 无法回滚'
    END AS backup_status;

-- 如果上述检查都通过，继续执行回滚：

-- ============================================================
-- 第 1 步：禁用外键检查
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 第 2 步：恢复 auth_users 表
-- ============================================================
DROP TABLE IF EXISTS auth_users;
CREATE TABLE auth_users AS SELECT * FROM auth_users_backup;

-- 重新创建主键和索引
ALTER TABLE auth_users ADD PRIMARY KEY (id);
ALTER TABLE auth_users ADD UNIQUE KEY unique_email (email);

SELECT 'auth_users 表已恢复' AS status;

-- ============================================================
-- 第 3 步：恢复 users 表
-- ============================================================
TRUNCATE TABLE users;
INSERT INTO users SELECT * FROM users_backup;

SELECT 'users 表已恢复' AS status;

-- ============================================================
-- 第 4 步：恢复 auth_sessions 外键
-- ============================================================
ALTER TABLE auth_sessions DROP FOREIGN KEY fk_auth_sessions_user;

ALTER TABLE auth_sessions 
ADD CONSTRAINT fk_auth_sessions_user 
FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;

SELECT 'auth_sessions 外键已恢复' AS status;

-- ============================================================
-- 第 5 步：重新启用外键检查
-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 第 6 步：验证回滚结果
-- ============================================================
SELECT 
    'auth_users' AS table_name,
    COUNT(*) AS record_count
FROM auth_users
UNION ALL
SELECT 
    'users' AS table_name,
    COUNT(*) AS record_count
FROM users;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '
=============================================================
回滚完成！

数据库已恢复到迁移前的状态。

注意事项：
1. 检查上述记录数是否与迁移前一致
2. 测试系统功能是否正常
3. 如果确认回滚成功，可以删除备份表：
   DROP TABLE auth_users_backup;
   DROP TABLE users_backup;

如果仍有问题，请检查数据库日志。
=============================================================
' AS message;
