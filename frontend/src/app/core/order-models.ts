import { Role } from './auth.service';

export interface Dealer {
  id: string;
  code: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
}
export type DealerRequest = Omit<Dealer, 'id'>;
export interface ProductRequest {
  code: string;
  name: string;
  category: string;
  unitPrice: number;
  availableStock: number;
  isActive: boolean;
  rowVersion: string | null;
}
export const ORDER_STATUSES = ['Draft', 'Submitted', 'Approved', 'Dispatched', 'Delivered', 'Rejected', 'Cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export interface OrderSummary {
  id: string;
  companyName: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
}
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface OrderHistory {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  username: string;
  timestamp: string;
  remarks: string | null;
}
export interface OrderDetails extends OrderSummary {
  dealerId: string;
  items: OrderItem[];
  history: OrderHistory[];
}
export interface DraftRequest { items: { productId: string; quantity: number }[]; }

export function permittedActions(role: Role, status: OrderStatus): OrderStatus[] {
  if (role === 'Admin') {
    switch (status) {
      case 'Submitted': return ['Approved', 'Rejected'];
      case 'Approved': return ['Dispatched'];
      case 'Dispatched': return ['Delivered'];
      default: return [];
    }
  }
  if (status === 'Draft') return ['Submitted', 'Cancelled'];
  return status === 'Submitted' ? ['Cancelled'] : [];
}
export const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  Submitted: 'Submit', Approved: 'Approve', Rejected: 'Reject',
  Cancelled: 'Cancel order', Dispatched: 'Mark dispatched', Delivered: 'Mark delivered'
};
