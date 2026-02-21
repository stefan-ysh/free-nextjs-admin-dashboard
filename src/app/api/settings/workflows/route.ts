import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { mysqlPool } from '@/lib/mysql';
import { ensureWorkflowConfigsSchema } from '@/lib/schema/workflows';
import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'crypto';

const pool = mysqlPool();

export async function GET() {
  try {
    const { user } = await requireCurrentUser();
    if (user.primary_role !== 'super_admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    await ensureWorkflowConfigsSchema();

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, description, module_name, organization_type, is_published, workflow_nodes, updated_at, updated_by FROM system_workflow_configs ORDER BY updated_at DESC'
    );

    // Parse workflow_nodes back to object for frontend
    const formattedRows = rows.map(row => ({
      ...row,
      is_published: Boolean(row.is_published),
      workflow_nodes: typeof row.workflow_nodes === 'string' 
        ? JSON.parse(row.workflow_nodes) 
        : row.workflow_nodes
    }));

    return NextResponse.json(formattedRows);
  } catch (error: Error | any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('Failed to get workflow configs:', error);
    return NextResponse.json({ error: '获取工作流配置失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireCurrentUser();
    if (user.primary_role !== 'super_admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    await ensureWorkflowConfigsSchema();

    const { name, description, module_name, organization_type } = await req.json();

    if (!name || !module_name || !organization_type) {
      return NextResponse.json({ error: '缺失必填项' }, { status: 400 });
    }

    const newId = randomUUID();
    const defaultNodes = {
      nodes: [
        { id: 'start', type: 'START', name: '开始', position: { x: 250, y: 50 } },
        { id: 'end', type: 'END', name: '结束', position: { x: 250, y: 400 } },
      ],
      edges: [
        { source: 'start', target: 'end', condition: 'ALWAYS' },
      ],
    };

    await pool.query(
      `INSERT INTO system_workflow_configs 
      (id, name, description, module_name, organization_type, is_published, workflow_nodes, updated_by, updated_at) 
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW())`,
      [newId, name, description || null, module_name, organization_type, JSON.stringify(defaultNodes), user.id]
    );

    return NextResponse.json({ 
      success: true, 
      id: newId,
      name,
      description,
      module_name,
      organization_type,
      is_published: false,
      workflow_nodes: defaultNodes
    });
  } catch (error: Error | any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('Failed to create workflow config:', error);
    return NextResponse.json({ error: '创建工作流配置失败' }, { status: 500 });
  }
}
