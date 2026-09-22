import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api';
import { ManagementApi } from './management-api';
import { ORDER_STATUSES, permittedActions } from './order-models';

const base = 'https://localhost:7020/api';

describe('Order action visibility', () => {
  it('shows only Dealer submission and cancellation actions', () => {
    expect(permittedActions('Dealer', 'Draft')).toEqual(['Submitted', 'Cancelled']);
    expect(permittedActions('Dealer', 'Submitted')).toEqual(['Cancelled']);
    for (const status of ORDER_STATUSES.filter(s => s !== 'Draft' && s !== 'Submitted')) {
      expect(permittedActions('Dealer', status)).toEqual([]);
    }
  });
  it('shows only Admin approval and fulfillment actions', () => {
    expect(permittedActions('Admin', 'Submitted')).toEqual(['Approved', 'Rejected']);
    expect(permittedActions('Admin', 'Approved')).toEqual(['Dispatched']);
    expect(permittedActions('Admin', 'Dispatched')).toEqual(['Delivered']);
    for (const status of ['Draft', 'Delivered', 'Rejected', 'Cancelled'] as const) {
      expect(permittedActions('Admin', status)).toEqual([]);
    }
  });
});

describe('ManagementApi', () => {
  let api: ManagementApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: base }] });
    api = TestBed.inject(ManagementApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends search, status and pagination to the server', () => {
    api.orders(' Demo ', 'Submitted', 2, 10).subscribe();
    const request = http.expectOne(r => r.url === `${base}/orders`);
    expect(request.request.params.get('search')).toBe('Demo');
    expect(request.request.params.get('status')).toBe('Submitted');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('10');
    request.flush({ success: true, data: { items: [], totalCount: 0, pageNumber: 2, pageSize: 10 } });
  });
  it('preserves the product row version on update', () => {
    api.saveProduct('product-id', { code: 'P1', name: 'Chair', category: 'Furniture', unitPrice: 150,
      availableStock: 47, isActive: false, rowVersion: 'AAAAAAAAB+Y=' }).subscribe();
    const request = http.expectOne(`${base}/products/product-id`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.rowVersion).toBe('AAAAAAAAB+Y=');
    expect(request.request.body.isActive).toBeFalse();
    request.flush({ success: true, data: { id: 'product-id' } });
  });
  it('creates dealer profiles without inventing login credentials', () => {
    api.saveDealer(null, { code: 'D1', companyName: 'Company', contactPerson: 'Contact',
      email: 'dealer@example.test', phone: '123', address: 'Address', isActive: true }).subscribe();
    const request = http.expectOne(`${base}/dealers`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.password).toBeUndefined();
    request.flush({ success: true, data: { id: 'dealer-id' } });
  });
  it('uses POST for creation and PUT for draft replacement', () => {
    const draft = { items: [{ productId: 'product-id', quantity: 2 }] };
    api.saveDraft(null, draft).subscribe();
    const create = http.expectOne(`${base}/orders`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(draft);
    create.flush({ success: true, data: { id: 'order-id' } });
    api.saveDraft('order-id', { items: [] }).subscribe();
    const update = http.expectOne(`${base}/orders/order-id`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ items: [] });
    update.flush({ success: true, data: { id: 'order-id' } });
  });
  it('sends status and remarks without swallowing conflicts', () => {
    api.transition('order-id', 'Approved', 'Reviewed').subscribe({
      next: () => fail('Must return the approval conflict'), error: error => expect(error.status).toBe(409)
    });
    const request = http.expectOne(`${base}/orders/order-id/status`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ status: 'Approved', remarks: 'Reviewed' });
    request.flush({ success: false, message: 'Insufficient stock.', data: null }, { status: 409, statusText: 'Conflict' });
  });
});
