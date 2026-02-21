import {
  WorkflowDefinitionJson,
  WorkflowNode,
  WorkflowEdge,
} from '@/types/workflow';

export class WorkflowEngine {
  private definition: WorkflowDefinitionJson;

  constructor(definition: unknown) {
    if (typeof definition === 'string') {
      try {
        this.definition = JSON.parse(definition);
      } catch {
        this.definition = { nodes: [], edges: [] };
      }
    } else {
      this.definition = (definition as WorkflowDefinitionJson) || { nodes: [], edges: [] };
    }
    
    // Ensure shape
    if (!this.definition.nodes) this.definition.nodes = [];
    if (!this.definition.edges) this.definition.edges = [];
  }

  public getNodeById(id: string): WorkflowNode | undefined {
    return this.definition.nodes.find(n => n.id === id);
  }

  /**
   * Calculate the next processable node in the workflow.
   * Traverses the graph from currentStepNodeId.
   * If currentStepNodeId is null, starts from START.
   * 
   * @param currentStepNodeId The node we are currently at.
   * @param action The action taken at currentStepNodeId (APPROVED, REJECTED), to determine the branch.
   * @param formContext Optional form data used to evaluate CONDITION nodes.
   */
  public calculateNextStep(
    currentStepNodeId: string | null,
    action?: 'APPROVED' | 'REJECTED',
    formContext?: Record<string, unknown>
  ): {
    nextNode: WorkflowNode | null;
    passedCcNodes: WorkflowNode[];
  } {
    const { nodes, edges } = this.definition;
    
    let currentNode: WorkflowNode | undefined;
    if (!currentStepNodeId) {
      currentNode = nodes.find(n => n.type === 'START');
    } else {
      currentNode = nodes.find(n => n.id === currentStepNodeId);
    }

    if (!currentNode) {
      throw new Error('WORKFLOW_NODE_NOT_FOUND');
    }

    const passedCcNodes: WorkflowNode[] = [];
    let nextNode: WorkflowNode | null = null;
    let processingNodeId = currentNode.id;
    let isFirstJump = true;

    let loopGuard = 0;
    while (loopGuard++ < 100) {
      const outgoingEdges = edges.filter(e => e.source === processingNodeId);
      if (outgoingEdges.length === 0) {
        break; // Dead end
      }

      // Determine which edge to follow
      let validEdge: WorkflowEdge | undefined;
      const currentProcessingNode = nodes.find(n => n.id === processingNodeId);

      if (currentProcessingNode?.type === 'CONDITION') {
        // Evaluate the condition and pick TRUE or FALSE branch
        const condResult = this.evaluateCondition(currentProcessingNode, formContext);
        const condEdgeType = condResult ? 'CONDITION_TRUE' : 'CONDITION_FALSE';
        validEdge = outgoingEdges.find(e => e.condition === condEdgeType)
          || outgoingEdges.find(e => !e.condition || e.condition === 'ALWAYS');
      } else if (isFirstJump && action) {
        validEdge = outgoingEdges.find(e => e.condition === action) || outgoingEdges.find(e => !e.condition || e.condition === 'ALWAYS');
      } else {
        validEdge = outgoingEdges.find(e => !e.condition || e.condition === 'ALWAYS');
      }

      isFirstJump = false;

      if (!validEdge) {
        break;
      }

      const targetNode = nodes.find(n => n.id === validEdge!.target);
      if (!targetNode) {
        break; // Corrupted graph
      }

      if (targetNode.type === 'CC') {
        passedCcNodes.push(targetNode);
        processingNodeId = targetNode.id;
        continue;
      }

      // CONDITION nodes are auto-evaluated (no pause)
      if (targetNode.type === 'CONDITION') {
        processingNodeId = targetNode.id;
        continue;
      }

      if (targetNode.type === 'APPROVAL' || targetNode.type === 'END' || targetNode.type === 'CONDITION_WAIT') {
        nextNode = targetNode;
        break;
      }
      
      processingNodeId = targetNode.id;
    }

    return { nextNode, passedCcNodes };
  }

  /**
   * Evaluate a CONDITION node's expression against form data.
   */
  private evaluateCondition(node: WorkflowNode, formContext?: Record<string, unknown>): boolean {
    if (node.type !== 'CONDITION') return true;
    if (!formContext) return true; // Default to true if no context

    const fieldValue = Number(formContext[node.conditionField] ?? 0);
    const compareValue = Number(node.conditionValue ?? 0);

    switch (node.conditionOp) {
      case 'gt': return fieldValue > compareValue;
      case 'gte': return fieldValue >= compareValue;
      case 'lt': return fieldValue < compareValue;
      case 'lte': return fieldValue <= compareValue;
      case 'eq': return fieldValue === compareValue;
      case 'neq': return fieldValue !== compareValue;
      default: return true;
    }
  }

  /**
   * Helper to get a list of all historical APPROVAL nodes before the current one using BFS.
   */
  public getHistoricalNodes(currentNodeId: string): WorkflowNode[] {
    const { nodes, edges } = this.definition;
    const history: WorkflowNode[] = [];
    const visited = new Set<string>();
    
    // Reverse edges map: target -> array of sources
    const revEdges = new Map<string, string[]>();
    for (const e of edges) {
      if (!revEdges.has(e.target)) revEdges.set(e.target, []);
      revEdges.get(e.target)!.push(e.source);
    }

    const queue: string[] = [currentNodeId];
    visited.add(currentNodeId);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      if (currId !== currentNodeId) {
        const node = nodes.find(n => n.id === currId);
        if (node && node.type === 'APPROVAL') {
          history.push(node);
        }
      }

      const parents = revEdges.get(currId) || [];
      for (const p of parents) {
        if (!visited.has(p)) {
          visited.add(p);
          queue.push(p);
        }
      }
    }

    // Since it's a backward traversal, the closest ancestors are found first.
    return history;
  }
}
