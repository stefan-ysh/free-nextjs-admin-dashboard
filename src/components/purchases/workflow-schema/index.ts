import type { WorkflowNodeSchema } from './types';
import { APPROVAL_NODE_SCHEMA } from './node-approval';

export function getWorkflowNodeSchema(): WorkflowNodeSchema {
  return APPROVAL_NODE_SCHEMA;
}
