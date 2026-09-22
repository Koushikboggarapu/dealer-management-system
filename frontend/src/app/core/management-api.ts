import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL, ApiResponse, Page, Product, unwrap } from './api';
import { Dealer, DealerRequest, DraftRequest, OrderDetails, OrderStatus, OrderSummary, ProductRequest } from './order-models';
import { ProductPriceHistoryEntry } from './product-price-history';

@Injectable({ providedIn: 'root' })
export class ManagementApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  dealers(search: string, page: number, size: number) {
    return this.http.get<ApiResponse<Page<Dealer>>>(`${this.base}/dealers`, {
      params: this.paging(search, page, size)
    }).pipe(map(response => unwrap(response)));
  }
  saveDealer(id: string | null, request: DealerRequest) {
    const result = id
      ? this.http.put<ApiResponse<Dealer>>(`${this.base}/dealers/${id}`, request)
      : this.http.post<ApiResponse<Dealer>>(`${this.base}/dealers`, request);
    return result.pipe(map(response => unwrap(response)));
  }
  saveProduct(id: string | null, request: ProductRequest) {
    const result = id
      ? this.http.put<ApiResponse<Product>>(`${this.base}/products/${id}`, request)
      : this.http.post<ApiResponse<Product>>(`${this.base}/products`, request);
    return result.pipe(map(response => unwrap(response)));
  }
  productPriceHistory(id: string, page: number, size: number) {
    return this.http.get<ApiResponse<Page<ProductPriceHistoryEntry>>>(
      `${this.base}/products/${encodeURIComponent(id)}/price-history`, {
        params: new HttpParams().set('page', page).set('size', size)
      }).pipe(map(response => unwrap(response)));
  }
  orders(search: string, status: OrderStatus | '', page: number, size: number) {
    let params = this.paging(search, page, size);
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<Page<OrderSummary>>>(`${this.base}/orders`, { params })
      .pipe(map(response => unwrap(response)));
  }
  order(id: string) {
    return this.http.get<ApiResponse<OrderDetails>>(`${this.base}/orders/${encodeURIComponent(id)}`)
      .pipe(map(response => unwrap(response)));
  }
  saveDraft(id: string | null, request: DraftRequest) {
    const result = id
      ? this.http.put<ApiResponse<OrderDetails>>(`${this.base}/orders/${encodeURIComponent(id)}`, request)
      : this.http.post<ApiResponse<OrderDetails>>(`${this.base}/orders`, request);
    return result.pipe(map(response => unwrap(response)));
  }
  transition(id: string, status: OrderStatus, remarks: string | null) {
    return this.http.post<ApiResponse<OrderDetails>>(`${this.base}/orders/${encodeURIComponent(id)}/status`, { status, remarks })
      .pipe(map(response => unwrap(response)));
  }
  private paging(search: string, page: number, size: number) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search.trim()) params = params.set('search', search.trim());
    return params;
  }
}
