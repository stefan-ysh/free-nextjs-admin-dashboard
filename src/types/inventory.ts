import type { ClientType } from '@/types/client';

export type InventoryDirection = 'inbound' | 'outbound';
export type InventoryMovementType = 'purchase' | 'transfer' | 'sale' | 'adjust' | 'return';

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
  unitPrice: number;
  salePrice: number;
  category: string;
  safetyStock: number;
  barcode?: string;
  specFields?: InventorySpecField[];
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

export interface InventoryInboundPayload {
  itemId: string;
  warehouseId: string;
  quantity: number;
  type: Extract<InventoryMovementType, 'purchase' | 'transfer' | 'adjust' | 'return'>;
  unitCost?: number;
  occurredAt?: string;
  attributes?: Record<string, string>;
  notes?: string;
}

export interface InventoryOutboundPayload {
  itemId: string;
  warehouseId: string;
  quantity: number;
  type: Extract<InventoryMovementType, 'sale' | 'transfer' | 'adjust' | 'return'>;
  relatedOrderId?: string;
  clientId?: string;
  clientType?: ClientType;
  clientName?: string;
  clientContact?: string;
  clientPhone?: string;
  clientAddress?: string;
  occurredAt?: string;
  attributes?: Record<string, string>;
  notes?: string;
}

export interface InventoryItemPayload {
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  salePrice: number;
  category: string;
  safetyStock: number;
  barcode?: string;
  specFields?: InventorySpecField[];
}

export interface WarehousePayload {
  name: string;
  code: string;
  type: Warehouse['type'];
  address?: string;
  capacity?: number;
  manager?: string;
}
