"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  module_name: string;
  organization_type: string;
  is_published: boolean;
  workflow_nodes: {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
  };
}

const MODULE_MAP: Record<string, string> = {
  purchase: '采购单',
  reimbursement: '报销单',
};

const ORG_MAP: Record<string, string> = {
  company: '单位 (Company)',
  school: '学校 (School)',
};

export default function WorkflowsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newModule, setNewModule] = useState('purchase');
  const [newOrg, setNewOrg] = useState('company');
  
  const { data: configs, isLoading, error } = useQuery<WorkflowConfig[]>({
    queryKey: ['workflow_configs'],
    queryFn: async () => {
      const res = await fetch('/api/settings/workflows');
      if (!res.ok) throw new Error('API Error');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          module_name: newModule,
          organization_type: newOrg
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '创建失败');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('流程创建成功');
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['workflow_configs'] });
      router.push(`/settings/workflows/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/workflows/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
    },
    onSuccess: () => {
      toast.success('流程已删除');
      queryClient.invalidateQueries({ queryKey: ['workflow_configs'] });
    }
  });

  const handleCreate = () => {
    if (!newName) {
      toast.error('情输入流程名称');
      return;
    }
    createMutation.mutate();
  };

  if (error) {
    return <div className="p-8 text-red-500">获取配置失败: {(error as Error).message}</div>;
  }

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载配置中...</div>;
  }



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">配置自定义审批流程</h2>
          <p className="text-sm text-muted-foreground">
            当用户发单时，系统会匹配这里状态为“已发布”的流程进行驱动流转。
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> 创建新流程
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>流程名称</TableHead>
              <TableHead>适用范围</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>链路概览</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  暂无自定义流程，系统将使用默认流转逻辑。
                </TableCell>
              </TableRow>
            )}
            {configs?.map((config) => {
              const isConfigured = config.workflow_nodes && Array.isArray(config.workflow_nodes.nodes) && config.workflow_nodes.nodes.length > 0;
              const isPublished = config.is_published;

              return (
                <TableRow key={config.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{config.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-sm truncate">{config.description || '暂无描述'}</div>
                  </TableCell>
                   <TableCell>
                    <div className="flex gap-2">
                       <Badge variant="outline" className="font-normal bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                         {MODULE_MAP[config.module_name] || config.module_name}
                       </Badge>
                       <Badge variant="outline" className="font-normal bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
                         {ORG_MAP[config.organization_type] || config.organization_type}
                       </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isConfigured ? (
                      isPublished ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent dark:bg-green-950/30 dark:text-green-400">
                          已发布
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent dark:bg-amber-950/30 dark:text-amber-400">
                          草稿 (未发布)
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground flex items-center gap-1 w-fit bg-muted/50">
                        <AlertCircle className="w-3 h-3" /> 未配置
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isConfigured ? (
                      <span className="text-sm font-medium">
                        {config.workflow_nodes.nodes.length} 节点, {config.workflow_nodes.edges.length} 分支
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">系统默认链路</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/settings/workflows/${config.id}`)}
                      className="shadow-sm mr-2"
                    >
                      <Settings className="w-4 h-4 mr-1.5" /> 编辑设计
                    </Button>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm('确定删除此流程配置吗？')) {
                          deleteMutation.mutate(config.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新审批流程</DialogTitle>
            <DialogDescription>
              创建一个可以动态挂载到表单上的工作流链条。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">流程名称</label>
              <Input 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="例如: 采购分管领导层层审批" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">关联表单/模块</label>
              <select className="w-full border rounded-md p-2 text-sm bg-background" value={newModule} onChange={e => setNewModule(e.target.value)}>
                <option value="purchase">采购单</option>
                <option value="reimbursement">报销单</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">适用组织范围</label>
              <select className="w-full border rounded-md p-2 text-sm bg-background" value={newOrg} onChange={e => setNewOrg(e.target.value)}>
                <option value="company">仅单位员工 (Company)</option>
                <option value="school">仅学校员工 (School)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">流程描述 (可选)</label>
              <Input 
                value={newDesc} 
                onChange={e => setNewDesc(e.target.value)} 
                placeholder="简述该流程的流转特征" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建并设计
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
