import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { mysqlPool } from '@/lib/mysql';
import { ensureWorkflowConfigsSchema } from '@/lib/schema/workflows';

const pool = mysqlPool();

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user } = await requireCurrentUser();
    if (user.primary_role !== 'super_admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    await ensureWorkflowConfigsSchema();

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: '缺失流程 ID' }, { status: 400 });
    }

    const updates = await req.json();
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description || null);
    }
    if (updates.is_published !== undefined) {
      updateFields.push('is_published = ?');
      updateValues.push(updates.is_published ? 1 : 0);
    }
    if (updates.workflow_nodes !== undefined) {
      updateFields.push('workflow_nodes = ?');
      updateValues.push(JSON.stringify(updates.workflow_nodes));
    }

    if (updateFields.length === 0) {
       return NextResponse.json({ success: true });
    }

    updateFields.push('updated_by = ?');
    updateValues.push(user.id);
    updateFields.push('updated_at = NOW()');

    updateValues.push(id);

    const sql = `UPDATE system_workflow_configs SET ${updateFields.join(', ')} WHERE id = ?`;
    await pool.query(sql, updateValues);

    return NextResponse.json({ success: true });
  } catch (error: Error | any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('Failed to update workflow config:', error);
    return NextResponse.json({ error: '更新工作流配置失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user } = await requireCurrentUser();
    if (user.primary_role !== 'super_admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: '缺失流程 ID' }, { status: 400 });
    }

    await pool.query('DELETE FROM system_workflow_configs WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: Error | any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('Failed to delete workflow config:', error);
    return NextResponse.json({ error: '删除工作流配置失败' }, { status: 500 });
  }
}
