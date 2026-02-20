export type ClientType = 'personal' | 'company';

export type InventoryDirection = 'inbound' | 'outbound';
export type InventoryMovementType = 'purchase' | 'transfer' | 'adjust' | 'return' | 'use';

export interface InventorySpecField {
  key: string;
  label: string;
  options?: string[];
  unit?: string;
  description?: string;
  defaultValue?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  safetyStock: number;
  imageUrl?: string;
  specFields?: InventorySpecField[];
  stockQuantity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'store' | 'virtual';
  address?: string;
  capacity?: number;
  manager?: string;
  stockQuantity?: number;
  stockReserved?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockSnapshot {
  itemId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  direction: InventoryDirection;
  type: InventoryMovementType;
  itemId: string;
  warehouseId: string;
  relatedOrderId?: string;
  relatedPurchaseId?: string;
  clientId?: string;
  clientType?: ClientType;
  clientName?: string;
  clientContact?: string;
  clientPhone?: string;
  clientAddress?: string;
  quantity: number;
  unitCost?: number;
  amount?: number;
  operatorId?: string;
  operatorName?: string;
  occurredAt: string;
  attachments?: string[];
  notes?: string;
  attributes?: Record<string, string>;
  createdAt: string;
}

export interface InventoryStats {
  totalItems: number;
  totalWarehouses: number;
  totalQuantity: number;
  lowStockItems: Array<{
    itemId: string;
    name: string;
    available: number;
    safetyStock: number;
  }>;
  todaysInbound: number;
  todaysOutbound: number;
}

export interface InventoryTransferOrder {
  transferId: string;
  itemId: string;
  itemName: string | null;
  itemSku: string | null;
  quantity: number;
  unitCost: number | null;
  amount: number | null;
  sourceWarehouseId: string | null;
  sourceWarehouseName: string | null;
  targetWarehouseId: string | null;
  targetWarehouseName: string | null;
  operatorId: string | null;
  occurredAt: string;
  notes: string | null;
}

export interface InventoryTransferMovement {
  id: string;
  direction: InventoryDirection;
  itemId: string;
  itemName: string | null;
  itemSku: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  unitCost: number | null;
  amount: number | null;
  operatorId: string | null;
  occurredAt: string;
  notes: string | null;
}

export interface InventoryTransferDetail extends InventoryTransferOrder {
  movements: InventoryTransferMovement[];
}

export interface InventoryInboundPayload {
  itemId: string;
  warehouseId: string;
  quantity: number;
  type: Extract<InventoryMovementType, 'purchase' | 'adjust' | 'return'>;
  relatedPurchaseId?: string;
  unitCost?: number;
  occurredAt?: string;
  attributes?: Record<string, string>;
  notes?: string;
}

export interface InventoryOutboundPayload {
  itemId: string;
  warehouseId: string;
  quantity: number;
  type: Extract<InventoryMovementType, 'transfer' | 'adjust' | 'return' | 'use'>;
  targetWarehouseId?: string;
  relatedOrderId?: string;
  occurredAt?: string;
  attributes?: Record<string, string>;
  notes?: string;
}

export interface InventoryReservePayload {
  itemId: string;
  warehouseId: string;
  quantity: number;
}

export interface InventoryItemPayload {
  sku: string;
  name: string;
  unit: string;
  category: string;
  safetyStock: number;
  imageUrl?: string;
  specFields?: InventorySpecField[];
}

export type InventoryApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface InventoryApplicationItem {
  id: string;
  applicationId: string;
  itemId: string;
  itemName: string; // snapshot for display
  itemSku: string; // snapshot 
  quantity: number;
  unit: string;
}

export interface InventoryApplication {
  id: string;
  number: string; // APP-YYYYMMDD-XXXX
  applicantId: string;
  applicantName: string;
  department?: string;
  status: InventoryApplicationStatus;
  type: 'use' | 'transfer'; // 'use' for internal requests
  reason?: string;
  items: InventoryApplicationItem[];
  warehouseId: string; // The target warehouse to take items from
  warehouseName: string;
  approverId?: string;
  approverName?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehousePayload {
  name: string;
  code: string;
  type: Warehouse['type'];
  address?: string;
  capacity?: number;
  manager?: string;
}
