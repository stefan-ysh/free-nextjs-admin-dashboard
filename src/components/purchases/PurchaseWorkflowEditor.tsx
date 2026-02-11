'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Save, Settings2, Trash2, Unlink2 } from 'lucide-react';
import { toast } from 'sonner';

import DataState from '@/components/common/DataState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import type {
  PurchaseWorkflowConfig,
  PurchaseWorkflowConfigInput,
  PurchaseWorkflowEdge,
  PurchaseWorkflowNode,
  WorkflowNodeType,
  WorkflowPortDirection,
} from '@/types/purchase-workflow';
import { UserRole } from '@/types/user';

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

type Point = { x: number; y: number };
type WorkflowPreset = 'standard' | 'simple';

const START_NODE_ID = '__start__';
const END_NODE_ID = '__end__';

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: UserRole.DEPARTMENT_MANAGER, label: '部门负责人' },
  { value: UserRole.FINANCE, label: '财务' },
  { value: UserRole.ADMIN, label: '管理员' },
  { value: UserRole.SUPER_ADMIN, label: '超级管理员' },
  { value: UserRole.HR, label: '人事' },
];

const NODE_TYPE_OPTIONS: Array<{ value: WorkflowNodeType; label: string }> = [
  { value: 'user_activity', label: '用户活动' },
  { value: 'system_activity', label: '系统活动' },
  { value: 'sub_process', label: '子流程' },
  { value: 'connection', label: '连接点' },
  { value: 'circulate', label: '传阅' },
];

const NODE_DEFAULT_NAME: Record<WorkflowNodeType, string> = {
  user_activity: '用户活动',
  system_activity: '系统活动',
  sub_process: '子流程',
  connection: '连接点',
  circulate: '传阅节点',
};

const CANVAS_WIDTH = 1200;
const CARD_WIDTH = 250;
const CARD_HEIGHT = 96;
const START_X = Math.round((CANVAS_WIDTH - CARD_WIDTH) / 2);
const START_Y = 24;
const NODE_START_Y = 170;
const NODE_GAP = 126;

function createNodeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEdgeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `edge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNodeType(node: PurchaseWorkflowNode): WorkflowNodeType {
  return node.nodeType ?? 'user_activity';
}

function isApprovalNode(node: PurchaseWorkflowNode): boolean {
  return normalizeNodeType(node) === 'user_activity';
}

function createEmptyNode(nodeType: WorkflowNodeType = 'user_activity'): PurchaseWorkflowNode {
  return {
    id: createNodeId(),
    nodeType,
    name: NODE_DEFAULT_NAME[nodeType],
    approverType: 'role',
    approverRole: UserRole.DEPARTMENT_MANAGER,
    approverUserId: null,
    approvalMode: 'serial',
    timeoutHours: 24,
    requiredComment: true,
    condition: {
      minAmount: null,
      maxAmount: null,
      organizationType: 'all',
    },
    position: null,
    extras: null,
  };
}

function cloneNode(node: PurchaseWorkflowNode): PurchaseWorkflowNode {
  return {
    ...node,
    id: createNodeId(),
    name: `${node.name}（副本）`,
    nodeType: node.nodeType ?? 'user_activity',
    condition: {
      minAmount: node.condition.minAmount ?? null,
      maxAmount: node.condition.maxAmount ?? null,
      organizationType: node.condition.organizationType ?? 'all',
    },
    position: null,
    extras: node.extras ? { ...node.extras } : null,
  };
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  return value;
}

function getNodeTypeLabel(nodeType: WorkflowNodeType): string {
  return NODE_TYPE_OPTIONS.find((item) => item.value === nodeType)?.label ?? '节点';
}

function getNodeTypeBadgeClass(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case 'system_activity':
      return 'border-sky-300 bg-sky-50 text-sky-700';
    case 'sub_process':
      return 'border-violet-300 bg-violet-50 text-violet-700';
    case 'connection':
      return 'border-zinc-300 bg-zinc-50 text-zinc-700';
    case 'circulate':
      return 'border-cyan-300 bg-cyan-50 text-cyan-700';
    case 'user_activity':
    default:
      return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  }
}

function getRoleLabel(role: string | null): string {
  if (!role) return '未设置角色';
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}

function getOrganizationLabel(branch: WorkflowBranch): string {
  if (branch === 'school') return '学校';
  if (branch === 'company') return '单位';
  return '通用';
}

function formatAmountRange(node: PurchaseWorkflowNode): string {
  const min = normalizeNumber(node.condition.minAmount ?? null);
  const max = normalizeNumber(node.condition.maxAmount ?? null);
  if (min == null && max == null) return '不限金额';
  if (min != null && max == null) return `>= ${min} 元`;
  if (min == null && max != null) return `<= ${max} 元`;
  return `${min} - ${max} 元`;
}

function linePath(from: Point, to: Point): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function getPortVector(port: WorkflowPortDirection): Point {
  switch (port) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 1 };
  }
}

function bezierPath(
  from: Point,
  fromPort: WorkflowPortDirection,
  to: Point,
  toPort: WorkflowPortDirection
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const strength = Math.max(48, Math.min(180, distance * 0.36));

  const fv = getPortVector(fromPort);
  const tv = getPortVector(toPort);

  const cp1 = {
    x: from.x + fv.x * strength,
    y: from.y + fv.y * strength,
  };
  const cp2 = {
    x: to.x + tv.x * strength,
    y: to.y + tv.y * strength,
  };

  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

function createPresetNodes(preset: WorkflowPreset): PurchaseWorkflowNode[] {
  if (preset === 'simple') {
    return [
      {
        id: createNodeId(),
        nodeType: 'user_activity',
        name: '管理员审批',
        approverType: 'role',
        approverRole: UserRole.ADMIN,
        approverUserId: null,
        approvalMode: 'serial',
        timeoutHours: 24,
        requiredComment: true,
        condition: { minAmount: null, maxAmount: null, organizationType: 'all' },
        position: null,
        extras: null,
      },
    ];
  }

  return [
    {
      id: createNodeId(),
      nodeType: 'user_activity',
      name: '部门负责人审批',
      approverType: 'role',
      approverRole: UserRole.DEPARTMENT_MANAGER,
      approverUserId: null,
      approvalMode: 'serial',
      timeoutHours: 24,
      requiredComment: true,
      condition: { minAmount: null, maxAmount: null, organizationType: 'all' },
      position: null,
      extras: null,
    },
    {
      id: createNodeId(),
      nodeType: 'user_activity',
      name: '管理员终审',
      approverType: 'role',
      approverRole: UserRole.ADMIN,
      approverUserId: null,
      approvalMode: 'serial',
      timeoutHours: 24,
      requiredComment: true,
      condition: { minAmount: null, maxAmount: null, organizationType: 'all' },
      position: null,
      extras: null,
    },
  ];
}

function getPortPoint(rect: Point, port: WorkflowPortDirection): Point {
  switch (port) {
    case 'top':
      return { x: rect.x + CARD_WIDTH / 2, y: rect.y };
    case 'right':
      return { x: rect.x + CARD_WIDTH, y: rect.y + CARD_HEIGHT / 2 };
    case 'bottom':
      return { x: rect.x + CARD_WIDTH / 2, y: rect.y + CARD_HEIGHT };
    case 'left':
      return { x: rect.x, y: rect.y + CARD_HEIGHT / 2 };
    default:
      return { x: rect.x + CARD_WIDTH / 2, y: rect.y + CARD_HEIGHT };
  }
}

export default function PurchaseWorkflowEditor() {
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('采购审批流程');
  const [enabled, setEnabled] = useState(true);
  const [nodes, setNodes] = useState<PurchaseWorkflowNode[]>([]);
  const [edges, setEdges] = useState<PurchaseWorkflowEdge[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<ApproverCandidate[]>([]);
  const [lastAction, setLastAction] = useState('已加载流程');
  const [pendingPort, setPendingPort] = useState<{ nodeId: string; port: WorkflowPortDirection } | null>(null);

  const canManage = hasPermission('PURCHASE_APPROVE');

  const loadConfig = useCallback(async () => {
    if (!canManage || permissionLoading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/purchases/workflow', { headers: { Accept: 'application/json' } });
      const payload: WorkflowResponse = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || '审批流程配置加载失败');
      }
      setWorkflowName(payload.data.config.name);
      setEnabled(payload.data.config.enabled);
      setNodes(payload.data.config.nodes);
      setEdges(payload.data.config.edges ?? []);
      setActiveNodeId(payload.data.config.nodes[0]?.id ?? null);
      setActiveEdgeId(null);
      setPendingPort(null);
      setApprovers(payload.data.approvers);
      setLastAction(`已加载节点 ${payload.data.config.nodes.length} 个`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [canManage, permissionLoading]);

  useEffect(() => {
    if (!permissionLoading && canManage) void loadConfig();
  }, [permissionLoading, canManage, loadConfig]);

  useEffect(() => {
    if (nodes.length === 0) {
      if (activeNodeId !== null) setActiveNodeId(null);
      return;
    }
    if (!activeNodeId || !nodes.some((node) => node.id === activeNodeId)) {
      setActiveNodeId(nodes[0].id);
    }
  }, [nodes, activeNodeId]);

  useEffect(() => {
    if (!activeEdgeId) return;
    if (!edges.some((item) => item.id === activeEdgeId)) {
      setActiveEdgeId(null);
    }
  }, [edges, activeEdgeId]);

  const approverMap = useMemo(() => {
    const map = new Map<string, ApproverCandidate>();
    for (const approver of approvers) map.set(approver.id, approver);
    return map;
  }, [approvers]);

  const nodePositions = useMemo(() => {
    const map = new Map<string, Point>();
    map.set(START_NODE_ID, { x: START_X, y: START_Y });
    nodes.forEach((node, idx) => {
      const x = Number.isFinite(node.position?.x) ? Number(node.position?.x) : START_X;
      const y = Number.isFinite(node.position?.y) ? Number(node.position?.y) : NODE_START_Y + idx * NODE_GAP;
      map.set(node.id, { x, y });
    });
    const endY = NODE_START_Y + Math.max(nodes.length, 1) * NODE_GAP + 44;
    map.set(END_NODE_ID, { x: START_X, y: endY });
    return map;
  }, [nodes]);

  const canvasHeight = useMemo(() => {
    const endPos = nodePositions.get(END_NODE_ID);
    return Math.max(560, (endPos?.y ?? 500) + CARD_HEIGHT + 80);
  }, [nodePositions]);

  const validation = useMemo(() => {
    const errors = new Map<string, string[]>();
    if (!workflowName.trim()) errors.set('__workflow__', ['流程名称不能为空']);

    const validNodeIds = new Set(nodes.map((n) => n.id));
    edges.forEach((edge) => {
      if (edge.sourceId === START_NODE_ID || edge.sourceId === END_NODE_ID || validNodeIds.has(edge.sourceId)) return;
      errors.set('__edges__', ['存在连线引用了无效节点，请删除该连线']);
    });

    nodes.forEach((node) => {
      const list: string[] = [];
      if (!node.name.trim()) list.push('节点名称不能为空');
      if (isApprovalNode(node)) {
        if (node.approverType === 'role' && !node.approverRole) list.push('按角色审批时必须选择角色');
        if (node.approverType === 'user' && !node.approverUserId) list.push('指定人员审批时必须选择审批人');
        if (!Number.isFinite(node.timeoutHours) || node.timeoutHours <= 0) list.push('超时时间必须大于 0');
        const min = normalizeNumber(node.condition.minAmount ?? null);
        const max = normalizeNumber(node.condition.maxAmount ?? null);
        if (min != null && max != null && min > max) list.push('最小金额不能大于最大金额');
      }
      if (list.length > 0) errors.set(node.id, list);
    });

    return errors;
  }, [nodes, edges, workflowName]);

  const branchValidation = useMemo(() => {
    const warnings: string[] = [];
    const approvalNodes = nodes.filter(isApprovalNode);
    if (!nodes.length) warnings.push('当前无节点，提交后将无法进入有效审批。');
    if (nodes.length > 0 && approvalNodes.length === 0) warnings.push('当前仅有非审批节点，至少需要一个“用户活动”节点。');
    if (!approvalNodes.some((node) => node.requiredComment)) warnings.push('建议至少一个“用户活动”节点开启意见必填。');
    if (edges.length === 0) warnings.push('当前没有连线，请使用节点四周连接点创建流程连线。');
    return warnings;
  }, [nodes, edges]);

  const activeNode = useMemo(() => nodes.find((item) => item.id === activeNodeId) ?? null, [nodes, activeNodeId]);
  const activeNodeIndex = useMemo(() => (activeNode ? nodes.findIndex((item) => item.id === activeNode.id) : -1), [nodes, activeNode]);

  const getApproverLabel = useCallback((node: PurchaseWorkflowNode) => {
    if (!isApprovalNode(node)) return getNodeTypeLabel(normalizeNodeType(node));
    if (node.approverType === 'user') {
      if (!node.approverUserId) return '未指定审批人';
      return approverMap.get(node.approverUserId)?.name ?? node.approverUserId;
    }
    return getRoleLabel(node.approverRole);
  }, [approverMap]);

  const updateNodeById = useCallback((nodeId: string, updater: (node: PurchaseWorkflowNode) => PurchaseWorkflowNode) => {
    setNodes((prev) => prev.map((item) => (item.id === nodeId ? updater(item) : item)));
  }, []);

  const addNode = useCallback((nodeType: WorkflowNodeType) => {
    const node = createEmptyNode(nodeType);
    setNodes((prev) => [...prev, node]);
    setActiveNodeId(node.id);
    setActiveEdgeId(null);
    setLastAction(`新增${getNodeTypeLabel(nodeType)}`);
  }, []);

  const moveNode = useCallback((index: number, direction: -1 | 1) => {
    setNodes((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [current] = next.splice(index, 1);
      next.splice(targetIndex, 0, current);
      return next;
    });
    setLastAction(direction < 0 ? '节点上移' : '节点下移');
  }, []);

  const duplicateNode = useCallback((index: number) => {
    setNodes((prev) => {
      const src = prev[index];
      if (!src) return prev;
      const copied = cloneNode(src);
      setActiveNodeId(copied.id);
      setLastAction('复制节点');
      return [...prev.slice(0, index + 1), copied, ...prev.slice(index + 1)];
    });
  }, []);

  const removeNode = useCallback((index: number) => {
    setNodes((prev) => {
      const deleting = prev[index];
      if (!deleting) return prev;
      const next = prev.filter((_, i) => i !== index);
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.sourceId !== deleting.id && edge.targetId !== deleting.id));
      return next;
    });
    setLastAction('删除节点');
  }, []);

  const removeActiveEdge = useCallback(() => {
    if (!activeEdgeId) return;
    setEdges((prev) => prev.filter((edge) => edge.id !== activeEdgeId));
    setActiveEdgeId(null);
    setLastAction('删除连线');
  }, [activeEdgeId]);

  const applyPreset = useCallback((preset: WorkflowPreset) => {
    const presetNodes = createPresetNodes(preset);
    setNodes(presetNodes);
    setEdges([
      {
        id: createEdgeId(),
        sourceId: START_NODE_ID,
        sourcePort: 'bottom',
        targetId: presetNodes[0]?.id ?? END_NODE_ID,
        targetPort: 'top',
      },
      ...(presetNodes.length > 1
        ? [
            {
              id: createEdgeId(),
              sourceId: presetNodes[0].id,
              sourcePort: 'bottom' as WorkflowPortDirection,
              targetId: presetNodes[1].id,
              targetPort: 'top' as WorkflowPortDirection,
            },
          ]
        : []),
      {
        id: createEdgeId(),
        sourceId: presetNodes[presetNodes.length - 1]?.id ?? START_NODE_ID,
        sourcePort: 'bottom',
        targetId: END_NODE_ID,
        targetPort: 'top',
      },
    ]);
    setPendingPort(null);
    setActiveEdgeId(null);
    setActiveNodeId(presetNodes[0]?.id ?? null);
    const name = preset === 'standard' ? '标准审批模板（部门负责人 -> 管理员终审）' : '精简审批模板（管理员直审）';
    setLastAction(`应用${name}`);
    toast.success(`已应用${name}`);
  }, []);

  const isValidNodeRef = useCallback((nodeId: string) => {
    if (nodeId === START_NODE_ID || nodeId === END_NODE_ID) return true;
    return nodes.some((item) => item.id === nodeId);
  }, [nodes]);

  const handlePortClick = useCallback((nodeId: string, port: WorkflowPortDirection) => {
    setActiveNodeId(nodeId === START_NODE_ID || nodeId === END_NODE_ID ? null : nodeId);
    setActiveEdgeId(null);

    if (!pendingPort) {
      setPendingPort({ nodeId, port });
      setLastAction('已选择连线起点');
      return;
    }

    if (pendingPort.nodeId === nodeId && pendingPort.port === port) {
      setPendingPort(null);
      setLastAction('已取消连线');
      return;
    }

    const source = pendingPort;
    const target = { nodeId, port };
    setPendingPort(null);

    if (source.nodeId === END_NODE_ID) {
      toast.error('结束节点不能作为连线起点');
      return;
    }
    if (target.nodeId === START_NODE_ID) {
      toast.error('开始节点不能作为连线终点');
      return;
    }
    if (!isValidNodeRef(source.nodeId) || !isValidNodeRef(target.nodeId)) {
      toast.error('连线节点无效');
      return;
    }

    setEdges((prev) => {
      const duplicated = prev.some(
        (edge) =>
          edge.sourceId === source.nodeId &&
          edge.sourcePort === source.port &&
          edge.targetId === target.nodeId &&
          edge.targetPort === target.port
      );
      if (duplicated) {
        toast.message('该连线已存在');
        return prev;
      }
      const next = [
        ...prev,
        {
          id: createEdgeId(),
          sourceId: source.nodeId,
          sourcePort: source.port,
          targetId: target.nodeId,
          targetPort: target.port,
        },
      ];
      setLastAction('新增连线');
      return next;
    });
  }, [pendingPort, isValidNodeRef]);

  const saveConfig = async () => {
    if (nodes.length === 0) {
      toast.error('请至少配置一个节点');
      return;
    }
    if (validation.size > 0) {
      toast.error('请先修正流程配置中的错误');
      return;
    }

    setSaving(true);
    try {
      const payload: PurchaseWorkflowConfigInput = {
        name: workflowName.trim(),
        enabled,
        nodes,
        edges,
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
      toast.success('审批流程已保存');
      setLastAction('流程已保存');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const sourceRect = nodePositions.get(edge.sourceId);
        const targetRect = nodePositions.get(edge.targetId);
        if (!sourceRect || !targetRect) return null;
        const from = getPortPoint(sourceRect, edge.sourcePort);
        const to = getPortPoint(targetRect, edge.targetPort);
        return { id: edge.id, d: bezierPath(from, edge.sourcePort, to, edge.targetPort) };
      })
      .filter((item): item is { id: string; d: string } => Boolean(item));
  }, [edges, nodePositions]);

  if (permissionLoading || loading) {
    return <DataState variant="loading" title="加载中" description="正在读取审批流程配置" className="min-h-[220px]" />;
  }

  if (!canManage) {
    return <DataState variant="error" title="无权访问" description="需要采购审批权限才能配置流程" className="min-h-[220px]" />;
  }

  if (error) {
    return (
      <DataState
        variant="error"
        title="流程配置加载失败"
        description={error}
        className="min-h-[220px]"
        action={<Button onClick={() => void loadConfig()}>重试</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-toolbar p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="mb-1 text-xs text-muted-foreground">流程名称</p>
            <Input value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
            {validation.get('__workflow__')?.map((message) => (
              <p key={message} className="mt-1 text-xs text-rose-600">{message}</p>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
            <div>
              <p className="text-sm font-medium">启用流程</p>
              <p className="text-xs text-muted-foreground">关闭后将沿用默认审批行为</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="text-xs text-muted-foreground">
            先点击某个连接点作为起点，再点击目标连接点创建连线；点击已有连线可删除。
          </div>
          <Button size="sm" onClick={saveConfig} disabled={saving || validation.size > 0 || nodes.length === 0}>
            <Save className="mr-1 h-4 w-4" />保存配置
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>节点数：{nodes.length}</span>
          <span>审批节点：{nodes.filter(isApprovalNode).length}</span>
          <span>连线数：{edgePaths.length}</span>
          <span>最近操作：{lastAction}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset('standard')}>
            应用标准审批模板
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset('simple')}>
            应用精简审批模板
          </Button>
          <div className="text-xs text-muted-foreground">
            业务主链：采购申请 {'->'} 管理员审批 {'->'} 入库/发票 {'->'} 报销提交 {'->'} 财务打款 {'->'} 通知申请人。
          </div>
        </div>

        {branchValidation.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {branchValidation.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="surface-card border border-border/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">流程画布</h3>
            <div className="text-xs text-muted-foreground">
              {pendingPort ? `连线起点：${pendingPort.nodeId} / ${pendingPort.port}` : '点击端口开始连线'}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/10 p-3">
            <div className="relative mx-auto min-h-[520px]" style={{ width: CANVAS_WIDTH, height: canvasHeight }}>
              <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
                {NODE_TYPE_OPTIONS.map((nodeType) => (
                  <Button key={`palette-${nodeType.value}`} variant="outline" size="sm" onClick={() => addNode(nodeType.value)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {nodeType.label}
                  </Button>
                ))}
              </div>

              <svg
                className="absolute inset-0 z-0"
                width={CANVAS_WIDTH}
                height={canvasHeight}
                viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
              >
                <defs>
                  <marker
                    id="wf-edge-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
                  </marker>
                  <marker
                    id="wf-edge-arrow-active"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="#7c3aed" />
                  </marker>
                </defs>
                {edgePaths.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.d}
                    fill="none"
                    stroke={activeEdgeId === edge.id || hoveredEdgeId === edge.id ? '#7c3aed' : '#64748b'}
                    strokeWidth={activeEdgeId === edge.id ? 3.5 : hoveredEdgeId === edge.id ? 3 : 2.5}
                    strokeLinecap="round"
                    markerEnd={activeEdgeId === edge.id || hoveredEdgeId === edge.id ? 'url(#wf-edge-arrow-active)' : 'url(#wf-edge-arrow)'}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId((prev) => (prev === edge.id ? null : prev))}
                    onClick={() => {
                      setActiveEdgeId(edge.id);
                      setActiveNodeId(null);
                    }}
                  />
                ))}
              </svg>

              {([START_NODE_ID, ...nodes.map((n) => n.id), END_NODE_ID] as string[]).map((id) => {
                const rect = nodePositions.get(id);
                if (!rect) return null;

                const node = nodes.find((n) => n.id === id) ?? null;
                const isStart = id === START_NODE_ID;
                const isEnd = id === END_NODE_ID;
                const isActive = activeNodeId === id;

                const cardTitle = isStart
                  ? '开始'
                  : isEnd
                    ? '结束'
                    : node?.name || '未命名节点';

                const subLine = isStart
                  ? '提交采购申请'
                  : isEnd
                    ? '流程完成'
                    : node
                      ? isApprovalNode(node)
                        ? `审批人：${getApproverLabel(node)}`
                        : `类型：${getNodeTypeLabel(normalizeNodeType(node))}`
                      : '';

                return (
                  <div
                    key={id}
                    className={cn(
                      'absolute z-10 rounded-md border bg-card px-3 py-2 shadow-sm',
                      isStart ? 'border-blue-300 bg-blue-50' : '',
                      isEnd ? 'border-emerald-300 bg-emerald-50' : '',
                      !isStart && !isEnd && (isActive ? 'border-primary bg-primary/5' : 'border-border/70'),
                      !isStart && !isEnd ? 'cursor-pointer' : ''
                    )}
                    style={{ left: rect.x, top: rect.y, width: CARD_WIDTH }}
                    onClick={() => {
                      if (isStart || isEnd) return;
                      setActiveNodeId(id);
                      setActiveEdgeId(null);
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{cardTitle}</span>
                      {!isStart && !isEnd && node ? (
                        <span className={cn('rounded border px-1.5 py-0.5 text-[10px]', getNodeTypeBadgeClass(normalizeNodeType(node)))}>
                          {getNodeTypeLabel(normalizeNodeType(node))}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{subLine}</p>
                    {!isStart && !isEnd && node ? (
                      <p className="text-xs text-muted-foreground">
                        {(node.condition.organizationType ? getOrganizationLabel(node.condition.organizationType as WorkflowBranch) : '通用')}
                        {isApprovalNode(node) ? ` / ${formatAmountRange(node)}` : ''}
                      </p>
                    ) : null}

                    {(['top', 'right', 'bottom', 'left'] as WorkflowPortDirection[]).map((port) => {
                      const portPoint = getPortPoint(rect, port);
                      const isPending = pendingPort?.nodeId === id && pendingPort.port === port;
                      return (
                        <button
                          key={`${id}-${port}`}
                          type="button"
                          className={cn(
                            'absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white',
                            isPending ? 'bg-violet-500' : 'bg-slate-500 hover:bg-slate-700'
                          )}
                          style={{ left: portPoint.x - rect.x, top: portPoint.y - rect.y }}
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePortClick(id, port);
                          }}
                          title={`连接点：${port}`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="surface-card border border-border/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">节点属性</h3>
          </div>

          {activeEdgeId ? (
            <div className="space-y-3">
              <div className="rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                当前选中连线：{activeEdgeId}
              </div>
              <Button variant="destructive" size="sm" onClick={removeActiveEdge}>
                <Unlink2 className="mr-1 h-3.5 w-3.5" />删除连线
              </Button>
            </div>
          ) : !activeNode ? (
            <DataState variant="empty" title="未选中节点" description="在流程画布中点击任意节点后可编辑属性" className="min-h-[260px]" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1">
                <Button variant="outline" size="sm" onClick={() => moveNode(activeNodeIndex, -1)} disabled={activeNodeIndex <= 0}>
                  <ArrowUp className="mr-1 h-3.5 w-3.5" />上移
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveNode(activeNodeIndex, 1)} disabled={activeNodeIndex >= nodes.length - 1}>
                  <ArrowDown className="mr-1 h-3.5 w-3.5" />下移
                </Button>
                <Button variant="outline" size="sm" onClick={() => duplicateNode(activeNodeIndex)}>
                  <Copy className="mr-1 h-3.5 w-3.5" />复制
                </Button>
                <Button variant="destructive" size="sm" onClick={() => removeNode(activeNodeIndex)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />删除
                </Button>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">节点名称</p>
                <Input value={activeNode.name} onChange={(event) => updateNodeById(activeNode.id, (n) => ({ ...n, name: event.target.value }))} />
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">节点类型</p>
                <Select
                  value={normalizeNodeType(activeNode)}
                  onValueChange={(value) => {
                    const nodeType = value as WorkflowNodeType;
                    updateNodeById(activeNode.id, (n) => ({
                      ...n,
                      nodeType,
                      name: n.name.trim() ? n.name : NODE_DEFAULT_NAME[nodeType],
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NODE_TYPE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">所属分支</p>
                <Select
                  value={(activeNode.condition.organizationType ?? 'all') as WorkflowBranch}
                  onValueChange={(value) => {
                    const branch = value as WorkflowBranch;
                    updateNodeById(activeNode.id, (n) => ({
                      ...n,
                      condition: { ...n.condition, organizationType: branch },
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">通用（全部组织）</SelectItem>
                    <SelectItem value="school">学校分支</SelectItem>
                    <SelectItem value="company">单位分支</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isApprovalNode(activeNode) ? (
                <>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">审批人类型</p>
                    <Select
                      value={activeNode.approverType}
                      onValueChange={(value) => updateNodeById(activeNode.id, (n) => ({
                        ...n,
                        approverType: value as PurchaseWorkflowNode['approverType'],
                        approverRole: value === 'role' ? n.approverRole ?? UserRole.DEPARTMENT_MANAGER : null,
                        approverUserId: value === 'user' ? n.approverUserId : null,
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">按角色</SelectItem>
                        <SelectItem value="user">指定人员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {activeNode.approverType === 'role' ? (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">审批角色</p>
                      <Select value={activeNode.approverRole ?? UserRole.DEPARTMENT_MANAGER} onValueChange={(value) => updateNodeById(activeNode.id, (n) => ({ ...n, approverRole: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">审批人员</p>
                      <Select value={activeNode.approverUserId ?? undefined} onValueChange={(value) => updateNodeById(activeNode.id, (n) => ({ ...n, approverUserId: value }))}>
                        <SelectTrigger><SelectValue placeholder="选择审批人员" /></SelectTrigger>
                        <SelectContent>
                          {approvers.map((approver) => (
                            <SelectItem key={approver.id} value={approver.id}>{approver.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">审批模式</p>
                    <Select value={activeNode.approvalMode} onValueChange={(value) => updateNodeById(activeNode.id, (n) => ({ ...n, approvalMode: value as PurchaseWorkflowNode['approvalMode'] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="serial">串签（逐级）</SelectItem>
                        <SelectItem value="any">或签（任一）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">最小金额（元）</p>
                      <Input
                        type="number"
                        min={0}
                        value={activeNode.condition.minAmount ?? ''}
                        onChange={(event) => updateNodeById(activeNode.id, (n) => ({
                          ...n,
                          condition: {
                            ...n.condition,
                            minAmount: event.target.value === '' ? null : Number(event.target.value),
                          },
                        }))}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">最大金额（元）</p>
                      <Input
                        type="number"
                        min={0}
                        value={activeNode.condition.maxAmount ?? ''}
                        onChange={(event) => updateNodeById(activeNode.id, (n) => ({
                          ...n,
                          condition: {
                            ...n.condition,
                            maxAmount: event.target.value === '' ? null : Number(event.target.value),
                          },
                        }))}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">超时阈值（小时）</p>
                    <Input
                      type="number"
                      min={1}
                      value={activeNode.timeoutHours}
                      onChange={(event) => updateNodeById(activeNode.id, (n) => ({ ...n, timeoutHours: Number(event.target.value || 24) }))}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">意见必填</p>
                      <p className="text-xs text-muted-foreground">审批时必须填写审批意见</p>
                    </div>
                    <Switch checked={activeNode.requiredComment} onCheckedChange={(checked) => updateNodeById(activeNode.id, (n) => ({ ...n, requiredComment: checked }))} />
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  该节点为非审批节点，不参与“审批人/审批模式”计算。适合表达系统处理、子流程或传阅等步骤。
                </div>
              )}

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
      </div>
    </div>
  );
}
