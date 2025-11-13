import { sql } from '@/lib/postgres';

let initialized = false;

/**
 * 采购管理表结构
 */
export async function ensurePurchasesSchema() {
  if (initialized) return;

  // 创建采购记录表
  await sql`
    CREATE TABLE IF NOT EXISTS purchases (
      -- ============ 核心字段 ============
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_number TEXT UNIQUE NOT NULL,
      
      -- ============ 基本信息 ============
      purchase_date DATE NOT NULL,
      item_name TEXT NOT NULL,
      specification TEXT,
      quantity NUMERIC(10,2) NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total_amount NUMERIC(15,2) NOT NULL,
      
      -- ============ 购买信息 ============
      purchase_channel TEXT NOT NULL,
      purchase_location TEXT,
      purchase_link TEXT,
      purpose TEXT NOT NULL,
      
      -- ============ 付款信息 ============
      payment_method TEXT NOT NULL,
      purchaser_id UUID NOT NULL,
      
      -- ============ 发票信息 ============
      invoice_type TEXT NOT NULL,
      invoice_images TEXT[] DEFAULT ARRAY[]::TEXT[],
      receipt_images TEXT[] DEFAULT ARRAY[]::TEXT[],
      
      -- ============ 项目关联 ============
      has_project BOOLEAN NOT NULL DEFAULT false,
      project_id UUID,
      
      -- ============ 状态流程 ============
      status TEXT NOT NULL DEFAULT 'draft',
      
      -- ============ 审批信息 ============
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by UUID,
      rejected_at TIMESTAMPTZ,
      rejected_by UUID,
      rejection_reason TEXT,
      paid_at TIMESTAMPTZ,
      paid_by UUID,
      
      -- ============ 其他 ============
      notes TEXT,
      attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
      
      -- ============ 审计字段 ============
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID NOT NULL,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      deleted_at TIMESTAMPTZ
    )
  `;

  // 创建报销流程日志表
  await sql`
    CREATE TABLE IF NOT EXISTS reimbursement_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_id UUID NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      operator_id UUID NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 创建索引 - purchases
  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_number 
    ON purchases(purchase_number)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_purchaser 
    ON purchases(purchaser_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_status 
    ON purchases(status) 
    WHERE is_deleted = false
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_project 
    ON purchases(project_id) 
    WHERE project_id IS NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_date 
    ON purchases(purchase_date DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_created_by 
    ON purchases(created_by)
  `;

  // 创建索引 - reimbursement_logs
  await sql`
    CREATE INDEX IF NOT EXISTS idx_reimbursement_logs_purchase 
    ON reimbursement_logs(purchase_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reimbursement_logs_created 
    ON reimbursement_logs(created_at DESC)
  `;

  // 添加约束
  await sql`
    DO $$
    BEGIN
      -- 数量约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_quantity_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_quantity_check
        CHECK (quantity > 0);
      END IF;
      
      -- 单价约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_unit_price_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_unit_price_check
        CHECK (unit_price >= 0);
      END IF;
      
      -- 总价约束（允许小误差）
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_total_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_total_check
        CHECK (abs(total_amount - (quantity * unit_price)) < 0.01);
      END IF;
      
      -- 购买渠道约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_channel_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_channel_check
        CHECK (purchase_channel IN ('online', 'offline'));
      END IF;
      
      -- 付款方式约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_payment_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_payment_check
        CHECK (payment_method IN ('wechat', 'alipay', 'bank_transfer', 'corporate_transfer', 'cash'));
      END IF;
      
      -- 发票类型约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_invoice_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_invoice_check
        CHECK (invoice_type IN ('special', 'general', 'none'));
      END IF;
      
      -- 状态约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_status_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_status_check
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'));
      END IF;
      
      -- 项目关联约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_project_check'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_project_check
        CHECK (
          (has_project = false) OR 
          (has_project = true AND project_id IS NOT NULL)
        );
      END IF;
      
      -- 外键：purchaser_id 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_purchaser_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_purchaser_fkey
        FOREIGN KEY (purchaser_id) REFERENCES users(id);
      END IF;
      
      -- 外键：created_by 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_created_by_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id);
      END IF;
      
      -- 外键：approved_by 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_approved_by_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES users(id);
      END IF;
      
      -- 外键：rejected_by 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_rejected_by_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_rejected_by_fkey
        FOREIGN KEY (rejected_by) REFERENCES users(id);
      END IF;
      
      -- 外键：paid_by 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_paid_by_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_paid_by_fkey
        FOREIGN KEY (paid_by) REFERENCES users(id);
      END IF;
      
      -- 外键：project_id 引用 projects
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_project_fkey'
      ) THEN
        ALTER TABLE purchases
        ADD CONSTRAINT purchases_project_fkey
        FOREIGN KEY (project_id) REFERENCES projects(id);
      END IF;
      
      -- 外键：reimbursement_logs.purchase_id 引用 purchases
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reimbursement_logs_purchase_fkey'
      ) THEN
        ALTER TABLE reimbursement_logs
        ADD CONSTRAINT reimbursement_logs_purchase_fkey
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;
      END IF;
      
      -- 外键：reimbursement_logs.operator_id 引用 users
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reimbursement_logs_operator_fkey'
      ) THEN
        ALTER TABLE reimbursement_logs
        ADD CONSTRAINT reimbursement_logs_operator_fkey
        FOREIGN KEY (operator_id) REFERENCES users(id);
      END IF;
      
      -- 日志操作类型约束
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reimbursement_logs_action_check'
      ) THEN
        ALTER TABLE reimbursement_logs
        ADD CONSTRAINT reimbursement_logs_action_check
        CHECK (action IN ('submit', 'approve', 'reject', 'pay', 'cancel', 'withdraw'));
      END IF;
    END
    $$
  `;

  initialized = true;
}
