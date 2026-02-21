"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  MarkerType,
  ReactFlowProvider,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Play, Loader2, UserCheck, Mail, GitBranch, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import ApprovalNode from './nodes/ApprovalNode';
import CcNode from './nodes/CcNode';
import ConditionNode from './nodes/ConditionNode';
import NotifyNode from './nodes/NotifyNode';
import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import { WorkflowNodePanel } from './WorkflowNodePanel';

const nodeTypes: NodeTypes = {
  START: StartNode,
  END: EndNode,
  APPROVAL: ApprovalNode,
  CC: CcNode,
  NOTIFY: NotifyNode,
  CONDITION: ConditionNode,
};

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'START',
    data: { label: '开始', type: 'START' },
    position: { x: 250, y: 50 },
    deletable: false,
  },
  {
    id: 'end',
    type: 'END',
    data: { label: '结束', type: 'END' },
    position: { x: 250, y: 400 },
    deletable: false,
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e_start-end',
    source: 'start',
    target: 'end',
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

interface DesignerProps {
  configId: string;
}

export interface WorkflowNodeJson {
  id: string;
  type: string;
  name: string;
  position?: { x: number, y: number };
  users?: string[];
  roles?: string[];
  waitCondition?: string;
  [key: string]: unknown;
}

export interface WorkflowEdgeJson {
  id?: string;
  source: string;
  target: string;
  condition?: string;
}

interface WorkflowConfigRow {
  id: string;
  name: string;
  module_name: string;
  organization_type: string;
  is_published: boolean;
  workflow_nodes: {
    nodes: WorkflowNodeJson[];
    edges: WorkflowEdgeJson[];
  };
}

function DesignerCanvas({ configId }: DesignerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isDraft, setIsDraft] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const { data: configs, isLoading: isFetchingConfigs } = useQuery<WorkflowConfigRow[]>({
    queryKey: ['workflow_configs'],
    queryFn: async () => {
      const res = await fetch('/api/settings/workflows');
      if (!res.ok) throw new Error('Failed to fetch configs');
      return res.json();
    }
  });

  useEffect(() => {
    if (configs) {
      const existing = configs.find((c: WorkflowConfigRow) => c.id === configId);
      if (existing && existing.workflow_nodes && existing.workflow_nodes.nodes) {
        // Map backend nodes to ReactFlow nodes
        const mappedNodes: Node[] = existing.workflow_nodes.nodes.map((n: WorkflowNodeJson) => ({
          id: n.id,
          type: n.type,
          position: n.position || { x: Math.random() * 500, y: Math.random() * 500 },
          data: { label: n.name, ...n },
          deletable: n.type !== 'START' && n.type !== 'END',
        }));

        const mappedEdges: Edge[] = (existing.workflow_nodes.edges || []).map((e: WorkflowEdgeJson) => ({
          id: `e_${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.condition === 'APPROVED' ? '同意' : e.condition === 'REJECTED' ? '驳回' : undefined,
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        }));

        setNodes(mappedNodes);
        setEdges(mappedEdges);
        setIsDraft(!existing.is_published);
      }
    }
  }, [configs, configId, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection | Edge) => {
    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [setEdges]);

  // 连线校验：禁止无效连接
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    // END 节点不能作为源
    if (nodes.find(n => n.id === connection.source)?.data.type === 'END') return false;
    // START 节点不能作为目标
    if (nodes.find(n => n.id === connection.target)?.data.type === 'START') return false;
    // 不能自连
    if (connection.source === connection.target) return false;
    return true;
  }, [nodes]);

  const createNode = (type: 'APPROVAL' | 'CC' | 'NOTIFY' | 'CONDITION') => {
    const newNodeId = `node_${Date.now()}`;
    // 计算新节点 y 坐标：在 start 和 end 之间依序排列
    const customNodeCount = nodes.filter(n => n.type !== 'START' && n.type !== 'END').length;
    const labelMap: Record<string, string> = {
      APPROVAL: '新审批节点',
      CC: '新抄送节点',
      NOTIFY: '新通知节点',
      CONDITION: '新条件分支',
    };
    const newNode: Node = {
      id: newNodeId,
      type,
      position: { x: 220, y: 120 + customNodeCount * 80 },
      data: {
        label: labelMap[type] || type,
        type,
      },
      deletable: true,
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNodeId);
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
  }, []);

  const handleUpdateNode = useCallback((id: string, partialData: Partial<WorkflowNodeJson>) => {
    setNodes((nds) => 
      nds.map((n) => {
        if (n.id === id) {
          // 同步 name 和 label
          const updatedData = { ...n.data, ...partialData };
          if ('name' in partialData) {
            updatedData.label = partialData.name;
          }
          return { ...n, data: updatedData };
        }
        return n;
      })
    );
  }, [setNodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) as unknown as { id: string, data: WorkflowNodeJson } | undefined;
  const drawerNode = selectedNode ? selectedNode.data : null;

  const handleUpdateEdge = useCallback((id: string, partialData: Partial<WorkflowEdgeJson>) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          const newCondition = partialData.condition;
          let label = undefined;
          let animated = e.animated;
          
          if (newCondition === 'APPROVED') { label = '同意'; animated = true; }
          else if (newCondition === 'REJECTED') { label = '驳回'; animated = true; }
          
          return {
            ...e,
            ...partialData,
            label,
            animated,
          };
        }
        return e;
      })
    );
  }, [setEdges]);

  const selectedEdge = edges.find(e => e.id === selectedEdgeId);
  const drawerEdge = selectedEdge ? { 
    id: selectedEdge.id, 
    source: selectedEdge.source, 
    target: selectedEdge.target, 
    condition: (selectedEdge as unknown as Record<string, string>).condition 
  } : null;

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!configs) throw new Error('Configs not loaded yet');

      // 1. Prepare currect workflow JSON
      const currentConfigPayload = {
        is_published: publish,
        workflow_nodes: {
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.data.type || n.type,
            name: n.data.label,
            position: n.position,
            users: n.data.users,
            roles: n.data.roles,
            waitCondition: n.data.waitCondition,
            conditionField: n.data.conditionField,
            conditionFieldType: n.data.conditionFieldType,
            conditionOp: n.data.conditionOp,
            conditionValue: n.data.conditionValue,
            conditionValue2: n.data.conditionValue2,
            emailTemplate: n.data.emailTemplate,
          })),
          edges: edges.map(e => ({
            source: e.source,
            target: e.target,
            condition: (e as unknown as Record<string, string>).condition || 'ALWAYS'
          }))
        }
      };

      const res = await fetch(`/api/settings/workflows/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfigPayload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      return publish;
    },
    onSuccess: (isPublished) => {
      toast.success(isPublished ? '流程已发布生效' : '草稿已保存');
      setIsDraft(!isPublished);
      queryClient.invalidateQueries({ queryKey: ['workflow_configs'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '保存失败');
    }
  });

  const handleSaveDraft = () => saveMutation.mutate(false);

  // 发布前 DAG 校验
  const validateWorkflow = (): string | null => {
    const startNode = nodes.find(n => n.data.type === 'START');
    const endNode = nodes.find(n => n.data.type === 'END');
    if (!startNode || !endNode) return '流程必须包含开始和结束节点';

    // BFS: START → END 可达性检查
    const adjacency = new Map<string, string[]>();
    for (const e of edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    }
    const visited = new Set<string>();
    const queue = [startNode.id];
    visited.add(startNode.id);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of (adjacency.get(curr) || [])) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (!visited.has(endNode.id)) return '开始节点无法到达结束节点，请检查连线';

    // 孤岛节点检查
    const orphans = nodes.filter(n => !visited.has(n.id));
    if (orphans.length > 0) {
      const orphanNames = orphans.map(n => n.data.label || n.id).join('、');
      return `以下节点未连入主流程: ${orphanNames}`;
    }

    // APPROVAL 节点必须指定人员
    const approvalNodes = nodes.filter(n => n.data.type === 'APPROVAL');
    for (const an of approvalNodes) {
      const users = an.data.users as string[] | undefined;
      if (!users || users.length === 0) {
        return `审批节点「${an.data.label || an.id}」尚未配置处理人`;
      }
    }

    return null; // 校验通过
  };

  const handlePublish = () => {
    const error = validateWorkflow();
    if (error) {
      toast.error(error);
      return;
    }
    saveMutation.mutate(true);
  };

  const currentConfig = configs?.find(c => c.id === configId);
  const name = currentConfig?.name || '未知流程';
  const orgStr = currentConfig?.organization_type === 'company' ? '单位' : '学校';
  const moduleName = currentConfig?.module_name === 'purchase' ? '采购' : '报销';

  return (
    <div className="flex-1 flex flex-col h-screen bg-background overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-background z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/settings/workflows')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{name}</h2>
            <p className="text-xs text-muted-foreground">{moduleName} · {orgStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm mr-4 hidden sm:inline-block ${isDraft ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500'}`}>
            状态: {isDraft ? '草稿' : '已发布生效'}
          </span>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saveMutation.isPending || isFetchingConfigs}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            保存
          </Button>
          <Button variant="default" size="sm" onClick={handlePublish} disabled={saveMutation.isPending || isFetchingConfigs}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            发布
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Nodes */}
        <aside className="w-16 md:w-[220px] border-r bg-muted/30 flex flex-col shrink-0 overflow-y-auto z-10">
          <div className="p-4 border-b bg-background/50">
            <h3 className="text-sm font-semibold hidden md:block">流程组件</h3>
            <p className="text-[10px] text-muted-foreground hidden md:block mt-1">点击添加节点到画布</p>
          </div>
          <div className="p-3 space-y-3">
            <div 
              role="button"
              className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors group shadow-sm"
              onClick={() => createNode('APPROVAL')}
            >
              <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium">审批节点</div>
                <div className="text-[10px] text-muted-foreground">处理审批流程</div>
              </div>
            </div>

            <div 
              role="button"
              className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors group shadow-sm"
              onClick={() => createNode('CC')}
            >
              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium">抄送节点</div>
                <div className="text-[10px] text-muted-foreground">通知相关人员</div>
              </div>
            </div>

            <div 
              role="button"
              className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors group shadow-sm"
              onClick={() => createNode('CONDITION')}
            >
              <div className="w-8 h-8 rounded bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium">条件分支</div>
                <div className="text-[10px] text-muted-foreground">根据条件走不同链路</div>
              </div>
            </div>

            <div 
              role="button"
              className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors group shadow-sm"
              onClick={() => createNode('NOTIFY')}
            >
              <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium">通知节点</div>
                <div className="text-[10px] text-muted-foreground">邮件通知指定人员</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 relative bg-muted/10 overflow-hidden dark:bg-dot-white/[0.1] bg-dot-black/[0.1]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            fitView
            attributionPosition="bottom-right"
            colorMode="system"
          >
            <Background />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </main>

        {/* Right Sidebar: Properties */}
        <WorkflowNodePanel 
          node={drawerNode as WorkflowNodeJson | null}
          edge={drawerEdge as WorkflowEdgeJson | null}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          onUpdateNode={handleUpdateNode}
          onUpdateEdge={handleUpdateEdge}
        />
      </div>
    </div>
  );
}

export default function WorkflowDesignerClient(props: DesignerProps) {
  return (
    <ReactFlowProvider>
      <DesignerCanvas {...props} />
    </ReactFlowProvider>
  );
}
