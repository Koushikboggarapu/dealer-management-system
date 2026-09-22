import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { map } from 'rxjs';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'https://localhost:7020/api'
});

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface Page<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface Dashboard {
  dealerCount: number;
  orderCounts: Record<string, number>;
}

export interface LowStockProduct {
  id: string;
  code: string;
  name: string;
  availableStock: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unitPrice: number;
  availableStock: number;
  isActive: boolean;
  rowVersion: string;
}

export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === null) {
    throw new Error(response.message || 'The server could not complete this request.');
  }
  return response.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Cannot reach the API. Start the HTTPS backend and check its development certificate at https://localhost:7020/swagger.';
    }
    if (error.status >= 500) return 'The server could not complete the request. Please try again.';
    const message: unknown = error.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (error.status === 401) return 'Your session is invalid or has expired. Please sign in again.';
    if (error.status === 403) return 'Your account does not have permission for this action.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return 'The request failed. Please try again.';
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  dashboard() {
    return this.http.get<ApiResponse<Dashboard>>(`${this.baseUrl}/dashboard`).pipe(map(unwrap));
  }

  lowStockProducts(page: number, size: number) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<Page<LowStockProduct>>>(`${this.baseUrl}/dashboard/low-stock`, { params }).pipe(map(unwrap));
  }

  products(search: string, page: number, size: number) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<ApiResponse<Page<Product>>>(`${this.baseUrl}/products`, { params }).pipe(map(unwrap));
  }
}
