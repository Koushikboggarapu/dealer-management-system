export interface ProductPriceHistoryEntry {
  id: string;
  productId: string;
  changedByUserId: string;
  changedByUsername: string;
  changedAt: string;
  oldPrice: number;
  newPrice: number;
}
