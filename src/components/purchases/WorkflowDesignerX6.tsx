'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Graph } from '@antv/x6';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { PurchaseWorkflowConfig, PurchaseWorkflowConfigInput, PurchaseWorkflowNode } from '@/types/purchase-workflow';
import { UserRole } from '@/types/user';
import SchemaFormRenderer from '@/components/purchases/workflow-schema/SchemaFormRenderer';
import { getWorkflowNodeSchema } from '@/components/purchases/workflow-schema';
import type { WorkflowSchemaOption } from '@/components/purchases/workflow-schema/types';

type WorkflowBranch = 'all' | 'school' | 'company';

type ApproverCandidate = {
  id: string;
  name: string;
  primaryRole: string | null;
  roles: string[];
};

type WorkflowResponse = {
  success: boolean;
  data?: {
    config: PurchaseWorkflowConfig;
    approvers: ApproverCandidate[];
  };
  error?: string;
};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: UserRole.DEPARTMENT_MANAGER, label: '部门负责人' },
  { value: UserRole.FINANCE, label: '财务' },
  { value: UserRole.ADMIN, label: '管理员' },
  { value: UserRole.SUPER_ADMIN, label: '超级管理员' },
  { value: UserRole.HR, label: '人事' },
];

const CANVAS_WIDTH = 1200;
const NODE_WIDTH = 240;
const NODE_HEIGHT = 88;
const X_CENTER = (CANVAS_WIDTH - NODE_WIDTH) / 2;
const BRANCH_X_LEFT = 180;
const BRANCH_X_RIGHT = CANVAS_WIDTH - NODE_WIDTH - BRANCH_X_LEFT;
const SYS_START_ID = 'sys:start';
const SYS_CONDITION_ID = 'sys:condition';
const SYS_END_ID = 'sys:end';

function nodeCellId(nodeId: string): string {
  return `wf:${nodeId}`;
}

function parseNodeId(cellId: string): string | null {
  if (!cellId.startsWith('wf:')) return null;
  return cellId.slice(3);
}

function createNodeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyNode(branch: WorkflowBranch): PurchaseWorkflowNode {
  return {
    id: createNodeId(),
    name: '新审批节点',
    approverType: 'role',
    approverRole: UserRole.DEPARTMENT_MANAGER,
    approverUserId: null,
    approvalMode: 'serial',
    timeoutHours: 24,
    requiredComment: true,
    condition: {
      minAmount: null,
      maxAmount: null,
      organizationType: branch,
    },
    position: null,
  };
}

function cloneNode(node: PurchaseWorkflowNode): PurchaseWorkflowNode {
  return {
    ...node,
    id: createNodeId(),
    name: `${node.name}（副本）`,
    condition: {
      minAmount: node.condition.minAmount ?? null,
      maxAmount: node.condition.maxAmount ?? null,
      organizationType: node.condition.organizationType ?? 'all',
    },
    position: node.position ? { ...node.position } : null,
  };
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  return value;
}

function getNodeBranch(node: PurchaseWorkflowNode): WorkflowBranch {
  const org = node.condition.organizationType ?? 'all';
  if (org === 'school' || org === 'company') return org;
  return 'all';
}

function defaultNodePosition(branch: WorkflowBranch, index: number): { x: number; y: number } {
  const y = branch === 'all' ? 180 + index * 120 : 520 + index * 120;
  if (branch === 'school') return { x: BRANCH_X_LEFT, y };
  if (branch === 'company') return { x: BRANCH_X_RIGHT, y };
  return { x: X_CENTER, y };
}

function withMissingPositions(nodes: PurchaseWorkflowNode[]): PurchaseWorkflowNode[] {
  const branchIndex: Record<WorkflowBranch, number> = { all: 0, school: 0, company: 0 };
  return nodes.map((node) => {
    if (node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
      return node;
    }
    const branch = getNodeBranch(node);
    const index = branchIndex[branch];
    branchIndex[branch] += 1;
    return {
      ...node,
      position: defaultNodePosition(branch, index),
    };
  });
}

function splitNodes(nodes: PurchaseWorkflowNode[]) {
  const grouped: Record<WorkflowBranch, PurchaseWorkflowNode[]> = { all: [], school: [], company: [] };
  for (const node of nodes) grouped[getNodeBranch(node)].push(node);
  return grouped;
}

function buildNodesFromGroups(groups: Record<WorkflowBranch, PurchaseWorkflowNode[]>) {
  return [...groups.all, ...groups.school, ...groups.company];
}

function tidyNodesLayout(nodes: PurchaseWorkflowNode[]): PurchaseWorkflowNode[] {
  const groups = splitNodes(nodes);
  const all = groups.all.map((node, index) => ({
    ...node,
    position: defaultNodePosition('all', index),
  }));

  const conditionY = all.length > 0 ? (all[all.length - 1].position?.y ?? 180) + 150 : 220;
  const schoolStartIndex = Math.max(0, Math.floor((conditionY - 520) / 120) + 1);
  const companyStartIndex = Math.max(0, Math.floor((conditionY - 520) / 120) + 1);

  const school = groups.school.map((node, index) => ({
    ...node,
    position: defaultNodePosition('school', schoolStartIndex + index),
  }));
  const company = groups.company.map((node, index) => ({
    ...node,
    position: defaultNodePosition('company', companyStartIndex + index),
  }));

  return [...all, ...school, ...company];
}

function getApproverLabel(node: PurchaseWorkflowNode, map: Map<string, ApproverCandidate>): string {
  if (node.approverType === 'user') {
    if (!node.approverUserId) return '未指定审批人';
    return map.get(node.approverUserId)?.name ?? node.approverUserId;
  }
  return ROLE_OPTIONS.find((r) => r.value === node.approverRole)?.label ?? node.approverRole ?? '未设置角色';
}

function makeNodeRect(
  node: PurchaseWorkflowNode,
  selected: boolean,
  approverMap: Map<string, ApproverCandidate>
) {
  const branch = getNodeBranch(node);
  const color = branch === 'school' ? '#2563eb' : branch === 'company' ? '#0ea5e9' : '#22c55e';
  return {
    id: nodeCellId(node.id),
    shape: 'rect',
    x: node.position?.x ?? X_CENTER,
    y: node.position?.y ?? 180,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    attrs: {
      body: {
        fill: selected ? '#eff6ff' : '#ffffff',
        stroke: selected ? '#2563eb' : '#94a3b8',
        strokeWidth: selected ? 2 : 1.2,
        rx: 8,
        ry: 8,
      },
      label: {
        text: `${node.name || '未命名节点'}\n${getApproverLabel(node, approverMap)}`,
        fill: '#0f172a',
        fontSize: 12,
      },
    },
    data: {
      kind: 'workflow',
      branch,
      barColor: color,
    },
  };
}

function makeSystemNode(
  id: string,
  x: number,
  y: number,
  title: string,
  desc: string,
  fill: string,
  stroke: string
) {
  return {
    id,
    shape: 'rect',
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    attrs: {
      body: { fill, stroke, strokeWidth: 1.2, rx: 8, ry: 8 },
      label: { text: `${title}\n${desc}`, fill: '#0f172a', fontSize: 12 },
    },
    data: { kind: 'system' },
  };
}

function makeEdge(source: string, target: string, dashed = false) {
  return {
    shape: 'edge',
    source: { cell: source },
    target: { cell: target },
    attrs: {
      line: {
        stroke: '#94a3b8',
        strokeWidth: 1.8,
        targetMarker: null,
        strokeDasharray: dashed ? '7 6' : undefined,
      },
    },
    connector: dashed ? { name: 'smooth' } : { name: 'normal' },
    zIndex: 0,
  };
}

function buildCells(nodes: PurchaseWorkflowNode[], selectedId: string | null, approverMap: Map<string, ApproverCandidate>) {
  const groups = splitNodes(nodes);
  const maxAllY = groups.all.reduce((m, n) => Math.max(m, n.position?.y ?? 0), 40);
  const conditionY = groups.all.length > 0 ? maxAllY + 150 : 220;
  const maxBranchY = Math.max(
    groups.school.reduce((m, n) => Math.max(m, n.position?.y ?? 0), conditionY + 180),
    groups.company.reduce((m, n) => Math.max(m, n.position?.y ?? 0), conditionY + 180)
  );
  const endY = maxBranchY + 180;

  const cells: Array<Record<string, unknown>> = [
    makeSystemNode(SYS_START_ID, X_CENTER, 30, '发起人', '提交采购申请', '#eff6ff', '#60a5fa'),
    makeSystemNode(SYS_CONDITION_ID, X_CENTER, conditionY, '条件分流', '按金额/组织路由', '#fffbeb', '#f59e0b'),
    makeSystemNode(SYS_END_ID, X_CENTER, endY, '流程汇合', '进入财务打款/完成', '#ecfdf5', '#34d399'),
  ];

  for (const node of nodes) {
    cells.push(makeNodeRect(node, selectedId === node.id, approverMap));
  }

  if (groups.all.length > 0) {
    cells.push(makeEdge(SYS_START_ID, nodeCellId(groups.all[0].id)));
    for (let i = 0; i < groups.all.length - 1; i += 1) {
      cells.push(makeEdge(nodeCellId(groups.all[i].id), nodeCellId(groups.all[i + 1].id)));
    }
    cells.push(makeEdge(nodeCellId(groups.all[groups.all.length - 1].id), SYS_CONDITION_ID));
  } else {
    cells.push(makeEdge(SYS_START_ID, SYS_CONDITION_ID));
  }

  if (groups.school.length > 0) {
    cells.push(makeEdge(SYS_CONDITION_ID, nodeCellId(groups.school[0].id), true));
    for (let i = 0; i < groups.school.length - 1; i += 1) {
      cells.push(makeEdge(nodeCellId(groups.school[i].id), nodeCellId(groups.school[i + 1].id)));
    }
    cells.push(makeEdge(nodeCellId(groups.school[groups.school.length - 1].id), SYS_END_ID, true));
  }

  if (groups.company.length > 0) {
    cells.push(makeEdge(SYS_CONDITION_ID, nodeCellId(groups.company[0].id), true));
    for (let i = 0; i < groups.company.length - 1; i += 1) {
      cells.push(makeEdge(nodeCellId(groups.company[i].id), nodeCellId(groups.company[i + 1].id)));
    }
    cells.push(makeEdge(nodeCellId(groups.company[groups.company.length - 1].id), SYS_END_ID, true));
  }

  if (groups.school.length === 0 && groups.company.length === 0) {
    cells.push(makeEdge(SYS_CONDITION_ID, SYS_END_ID));
  }

  return { cells, height: endY + 180 };
}

function setNodeValueByPath(node: PurchaseWorkflowNode, path: string, value: unknown): PurchaseWorkflowNode {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...node, [parts[0]]: value } as PurchaseWorkflowNode;
  }

  const cloned: Record<string, unknown> = { ...node };
  let cursor: Record<string, unknown> = cloned;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const child = cursor[key];
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      cursor[key] = {};
    } else {
      cursor[key] = { ...(child as Record<string, unknown>) };
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return cloned as unknown as PurchaseWorkflowNode;
}

export default function WorkflowDesignerX6() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('采购审批流程');
  const [enabled, setEnabled] = useState(true);
  const [nodes, setNodes] = useState<PurchaseWorkflowNode[]>([]);
  const [canvasHeight, setCanvasHeight] = useState(860);
  const [renderStats, setRenderStats] = useState({ graphNodes: 0, graphEdges: 0, domSvg: 0 });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<ApproverCandidate[]>([]);

  const approverMap = useMemo(() => {
    const m = new Map<string, ApproverCandidate>();
    for (const item of approvers) m.set(item.id, item);
    return m;
  }, [approvers]);
  const nodeSchema = useMemo(() => getWorkflowNodeSchema(), []);
  const approverOptions = useMemo<WorkflowSchemaOption[]>(
    () => approvers.map((item) => ({ value: item.id, label: item.name })),
    [approvers]
  );

  const activeNode = useMemo(() => nodes.find((item) => item.id === activeNodeId) ?? null, [nodes, activeNodeId]);

  const graphRef = useRef<Graph | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const validation = useMemo(() => {
    const errors = new Map<string, string[]>();
    nodes.forEach((node) => {
      const nodeErrors: string[] = [];
      if (!node.name.trim()) nodeErrors.push('节点名称不能为空');
      if (node.approverType === 'role' && !node.approverRole) nodeErrors.push('按角色审批时必须选择角色');
      if (node.approverType === 'user' && !node.approverUserId) nodeErrors.push('指定人员审批时必须选择审批人');
      if (!Number.isFinite(node.timeoutHours) || node.timeoutHours <= 0) nodeErrors.push('超时时间必须大于 0');
      const min = normalizeNumber(node.condition.minAmount ?? null);
      const max = normalizeNumber(node.condition.maxAmount ?? null);
      if (min != null && max != null && min > max) nodeErrors.push('最小金额不能大于最大金额');
      if (nodeErrors.length > 0) errors.set(node.id, nodeErrors);
    });
    if (!workflowName.trim()) errors.set('__workflow__', ['流程名称不能为空']);
    return errors;
  }, [nodes, workflowName]);

  const hasValidationError = validation.size > 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/purchases/workflow', { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as WorkflowResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '流程配置加载失败');
      }

      const normalized = withMissingPositions(payload.data.config.nodes);
      const hydrated = normalized.length > 0 ? normalized : [createEmptyNode('all')];
      if (normalized.length === 0) {
        hydrated[0].position = defaultNodePosition('all', 0);
      }
      setWorkflowName(payload.data.config.name);
      setEnabled(payload.data.config.enabled);
      setNodes(tidyNodesLayout(hydrated));
      setApprovers(payload.data.approvers);
      setActiveNodeId(hydrated[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '流程配置加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || error) return;
    if (nodes.length > 0) return;
    const fallback = createEmptyNode('all');
    fallback.position = defaultNodePosition('all', 0);
    setNodes([fallback]);
    setActiveNodeId(fallback.id);
  }, [loading, error, nodes]);

  useEffect(() => {
    return () => {
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (graphRef.current) {
      graphRef.current.dispose();
      graphRef.current = null;
    }

    let graph: Graph;
    try {
      graph = new Graph({
        container: containerRef.current,
        width: CANVAS_WIDTH,
        height: 860,
        grid: { visible: true, type: 'mesh', size: 18, args: { color: '#edf2f7', thickness: 1 } },
        mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'], minScale: 0.5, maxScale: 1.8 },
        panning: { enabled: true, eventTypes: ['leftMouseDown', 'mouseWheel'] },
        connecting: { allowBlank: false, allowLoop: false, allowNode: false, allowEdge: false },
        interacting: (cellView) => {
          const data = cellView.cell.getData<{ kind?: string }>();
          if (data?.kind === 'system') return { nodeMovable: false };
          return { nodeMovable: false };
        },
      });

      graph.on('node:click', ({ node }) => {
        const id = parseNodeId(node.id);
        if (id) {
          setActiveNodeId(id);
          try {
            graph?.centerCell(node);
          } catch {
            // ignore focus errors to avoid interrupting node selection
          }
        }
      });

      graphRef.current = graph;
    } catch (initError) {
      console.error('X6 初始化失败', initError);
      setRenderError('X6 初始化失败');
      setRenderStats({ graphNodes: 0, graphEdges: 0, domSvg: 0 });
      return;
    }

    const { cells, height } = buildCells(nodes, activeNodeId, approverMap);
    setCanvasHeight(Math.max(height, 860));

    syncingRef.current = true;
    try {
      setRenderError(null);
      graph.clearCells();
      const nodeCells = cells.filter((cell) => cell.shape !== 'edge');
      const edgeCells = cells.filter((cell) => cell.shape === 'edge');

      nodeCells.forEach((cell) => graph.addNode(cell as any));
      edgeCells.forEach((cell) => graph.addEdge(cell as any));

      graph.resize(CANVAS_WIDTH, Math.max(height, 860));
      graph.centerContent();
      setRenderStats({
        graphNodes: graph.getNodes().length,
        graphEdges: graph.getEdges().length,
        domSvg: containerRef.current?.querySelectorAll('svg').length ?? 0,
      });
    } catch (renderError) {
      console.error('X6 画布渲染失败', renderError);
      setRenderError(
        renderError instanceof Error
          ? renderError.message
          : '未知渲染错误'
      );
      setRenderStats({ graphNodes: 0, graphEdges: 0, domSvg: 0 });
    }

    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, [nodes, activeNodeId, approverMap]);

  const updateNodeById = useCallback((nodeId: string, updater: (node: PurchaseWorkflowNode) => PurchaseWorkflowNode) => {
    setNodes((prev) => prev.map((item) => (item.id === nodeId ? updater(item) : item)));
  }, []);

  const updateActiveNodeField = useCallback(
    (path: string, value: unknown) => {
      if (!activeNode) return;
      setNodes((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== activeNode.id) return item;
          const next = setNodeValueByPath(item, path, value);
          if (path === 'approverType' && value === 'role') {
            return {
              ...next,
              approverType: 'role' as const,
              approverRole: (typeof next.approverRole === 'string' && next.approverRole) ? next.approverRole : UserRole.DEPARTMENT_MANAGER,
              approverUserId: null,
            };
          }
          if (path === 'approverType' && value === 'user') {
            return {
              ...next,
              approverType: 'user' as const,
              approverRole: null,
            };
          }
          return next;
        });
        if (path === 'condition.organizationType') return tidyNodesLayout(updated);
        return updated;
      });
    },
    [activeNode]
  );

  const addNode = useCallback((branch: WorkflowBranch) => {
    const node = createEmptyNode(branch);
    setNodes((prev) => tidyNodesLayout([...prev, node]));
    setActiveNodeId(node.id);
  }, []);

  const moveNode = useCallback((direction: -1 | 1) => {
    if (!activeNode) return;
    const branch = getNodeBranch(activeNode);

    setNodes((prev) => {
      const groups = splitNodes(prev);
      const arr = [...groups[branch]];
      const idx = arr.findIndex((n) => n.id === activeNode.id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= arr.length) return prev;
      const [moving] = arr.splice(idx, 1);
      arr.splice(target, 0, moving);
      groups[branch] = arr;
      return tidyNodesLayout(buildNodesFromGroups(groups));
    });
  }, [activeNode]);

  const duplicateActive = useCallback(() => {
    if (!activeNode) return;
    const copied = cloneNode(activeNode);
    setNodes((prev) => tidyNodesLayout([...prev, copied]));
    setActiveNodeId(copied.id);
  }, [activeNode]);

  const removeActive = useCallback(() => {
    if (!activeNode) return;
    setNodes((prev) => tidyNodesLayout(prev.filter((item) => item.id !== activeNode.id)));
    setActiveNodeId(null);
  }, [activeNode]);

  const save = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error('请至少添加一个审批节点');
      return;
    }
    if (hasValidationError) {
      toast.error('请先修正流程配置中的错误');
      return;
    }

    setSaving(true);
    try {
      const payload: PurchaseWorkflowConfigInput = {
        name: workflowName.trim(),
        enabled,
        nodes: nodes,
      };
      const response = await fetch('/api/purchases/workflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存失败');
      }
      toast.success('流程配置已保存');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [nodes, hasValidationError, workflowName, enabled]);

  if (loading) {
    return <DataState variant="loading" title="加载中" description="正在读取流程配置" className="min-h-screen" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <DataState
          variant="error"
          title="流程配置加载失败"
          description={error}
          action={<Button onClick={() => void load()}>重试</Button>}
          className="min-h-[320px]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/purchases/workflow">
                <ArrowLeft className="mr-1 h-4 w-4" />返回流程列表
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">采购流程设计器（X6）</h1>
              <p className="text-xs text-muted-foreground">独立页面，无 header/sidebar，节点按分支与顺序自动排版。</p>
            </div>
          </div>
          <Button size="sm" onClick={save} disabled={saving || hasValidationError}>
            <Save className="mr-1 h-4 w-4" />保存
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1680px] gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-border/70 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">流程信息</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-8 w-[260px]" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="流程名称" />
                <div className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1 text-xs">
                  <span>启用流程</span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => addNode('all')}><Plus className="mr-1 h-3.5 w-3.5" />通用节点</Button>
              <Button size="sm" variant="outline" onClick={() => addNode('school')}><Plus className="mr-1 h-3.5 w-3.5" />学校节点</Button>
              <Button size="sm" variant="outline" onClick={() => addNode('company')}><Plus className="mr-1 h-3.5 w-3.5" />单位节点</Button>
            </div>
          </div>

          <p className="mb-2 text-xs text-muted-foreground">
            诊断：节点 {renderStats.graphNodes}，连线 {renderStats.graphEdges}，DOM SVG {renderStats.domSvg}
          </p>
          {renderError ? (
            <p className="mb-2 text-xs text-destructive">渲染错误：{renderError}</p>
          ) : null}

          <div className="overflow-auto rounded-lg border border-border/60 bg-muted/10 p-2">
            <div
              ref={containerRef}
              style={{ width: `${CANVAS_WIDTH}px`, height: `${canvasHeight}px`, position: 'relative' }}
            />
          </div>
        </section>

        <aside className="rounded-lg border border-border/70 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">节点属性</h2>

          {!activeNode ? (
            <DataState variant="empty" title="未选中节点" description="点击画布中的审批节点后在这里编辑" className="min-h-[280px]" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => moveNode(-1)}>
                  <ArrowUp className="mr-1 h-3.5 w-3.5" />上移
                </Button>
                <Button size="sm" variant="outline" onClick={() => moveNode(1)}>
                  <ArrowDown className="mr-1 h-3.5 w-3.5" />下移
                </Button>
                <Button size="sm" variant="outline" onClick={duplicateActive}>
                  <Copy className="mr-1 h-3.5 w-3.5" />复制
                </Button>
                <Button size="sm" variant="destructive" onClick={removeActive}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />删除
                </Button>
              </div>

              <SchemaFormRenderer
                node={activeNode}
                fields={nodeSchema.fields}
                dynamicOptions={{ approverUsers: approverOptions }}
                onFieldChange={updateActiveNodeField}
              />

              {(validation.get(activeNode.id) ?? []).length > 0 ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {(validation.get(activeNode.id) ?? []).map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
