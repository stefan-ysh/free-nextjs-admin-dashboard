#!/bin/bash

# ================================================================
# 用户表合并 - 快速执行脚本
# 请在执行前仔细阅读每一步！
# ================================================================

echo "=========================================="
echo "用户表合并迁移 - 开始"
echo "=========================================="
echo ""

# 设置数据库连接变量（请根据实际情况修改）
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="your_database_name"
DB_USER="your_username"
DB_PASS="your_password"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  重要提醒：${NC}"
echo "1. 确认当前是开发/测试环境"
echo "2. 确保已备份数据库"
echo "3. 建议在业务低峰期执行"
echo ""

read -p "是否已完成数据库备份？(yes/no): " backup_confirmed
if [ "$backup_confirmed" != "yes" ]; then
    echo -e "${RED}请先备份数据库！${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ 开始执行迁移...${NC}"
echo ""

# 步骤 1: 备份数据库
echo "步骤 1/4: 备份数据库..."
BACKUP_FILE="backup_before_migration_$(date +%Y%m%d_%H%M%S).sql"

mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 备份完成: $BACKUP_FILE${NC}"
    BACKUP_SIZE=$(ls -lh $BACKUP_FILE | awk '{print $5}')
    echo "  备份文件大小: $BACKUP_SIZE"
else
    echo -e "${RED}✗ 备份失败！${NC}"
    exit 1
fi

echo ""

# 步骤 2: 执行迁移SQL
echo "步骤 2/4: 执行数据迁移..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < scripts/migration_users_consolidation.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 迁移SQL执行完成${NC}"
else
    echo -e "${RED}✗ 迁移SQL执行失败！${NC}"
    echo "请检查错误日志，必要时执行回滚脚本"
    exit 1
fi

echo ""

# 步骤 3: 验证数据
echo "步骤 3/4: 验证数据完整性..."

# 检查users表记录数
USERS_COUNT=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -N -e "SELECT COUNT(*) FROM users" $DB_NAME)
echo "  users表记录数: $USERS_COUNT"

# 检查会话关联
ORPHAN_SESSIONS=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -N -e "SELECT COUNT(*) FROM auth_sessions s LEFT JOIN users u ON s.user_id = u.id WHERE u.id IS NULL" $DB_NAME)

if [ "$ORPHAN_SESSIONS" -eq 0 ]; then
    echo -e "${GREEN}✓ 会话关联验证通过${NC}"
else
    echo -e "${RED}✗ 发现 $ORPHAN_SESSIONS 条孤立会话记录${NC}"
fi

echo ""

# 步骤 4: 提示后续操作
echo "步骤 4/4: 后续操作提示"
echo ""
echo -e "${YELLOW}接下来需要：${NC}"
echo "1. 重启应用服务（代码已更新为使用users表）"
echo "2. 测试登录功能"
echo "3. 测试用户创建功能"
echo "4. 测试人员筛选功能（采购、财务）"
echo "5. 监控系统日志"
echo ""

echo -e "${GREEN}=========================================="
echo "迁移执行完成！"
echo "==========================================${NC}"
echo ""
echo "备份文件: $BACKUP_FILE"
echo "如需回滚，执行: mysql -u $DB_USER -p $DB_NAME < scripts/migration_rollback.sql"
echo ""

read -p "是否现在重启应用？(yes/no): " restart_confirmed
if [ "$restart_confirmed" == "yes" ]; then
    echo "请根据您的部署方式执行重启命令，例如："
    echo "  - pm2 restart your-app"
    echo "  - docker-compose restart"
    echo "  - npm run dev (开发环境)"
fi
