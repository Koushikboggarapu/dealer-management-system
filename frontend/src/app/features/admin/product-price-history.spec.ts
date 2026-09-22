import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL, Product } from '../../core/api';
import { ProductPriceHistory } from './product-price-history';

const base = 'https://localhost:7020/api';
const product: Product = { id: 'product-a', code: 'UI-A', name: 'Product A', category: 'Testing',
  unitPrice: 150, availableStock: 10, isActive: true, rowVersion: 'AAAAAAAAB+Y=' };
const entry = { id: 'history-1', productId: product.id, changedByUserId: 'admin-id', changedByUsername: 'admin',
  changedAt: '2026-09-22T10:00:00Z', oldPrice: 100, newPrice: 150 };

describe('Product price history', () => {
  let fixture: ComponentFixture<ProductPriceHistory>;
  let http: HttpTestingController;
  const url = `${base}/products/${product.id}/price-history`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductPriceHistory],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: base }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductPriceHistory);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('loads the selected product and renders the actor, timestamp and both prices', () => {
    expect(fixture.componentInstance.loading()).toBeTrue();
    const request = http.expectOne(r => r.url === url);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('10');
    request.flush({ success: true, data: { items: [entry], totalCount: 1, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    const row: HTMLTableRowElement = fixture.nativeElement.querySelector('tbody tr');
    expect(row.cells[0].textContent).toContain('admin');
    expect(row.cells[1].textContent?.trim()).toBeTruthy();
    expect(row.cells[2].textContent).toContain('100.00');
    expect(row.cells[3].textContent).toContain('150.00');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('explains that no history exists rather than inventing past changes', () => {
    http.expectOne(r => r.url === url).flush({ success: true,
      data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No price changes recorded');
    expect(fixture.nativeElement.textContent).toContain('before auditing was enabled');
  });

  it('requests the next page without changing the selected product', () => {
    http.expectOne(r => r.url === url).flush({ success: true,
      data: { items: [entry], totalCount: 11, pageNumber: 1, pageSize: 10 } });
    fixture.componentInstance.changePage({ pageIndex: 1, pageSize: 10, length: 11 });
    const request = http.expectOne(r => r.url === url);
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ success: true, data: { items: [], totalCount: 11, pageNumber: 2, pageSize: 10 } });
    expect(fixture.componentInstance.pageIndex()).toBe(1);
  });

  it('shows a permission error and allows a refresh after failure', () => {
    http.expectOne(r => r.url === url).flush({ success: false, message: 'Access denied.', data: null },
      { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Access denied');
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(r => r.url === url).flush({ success: true,
      data: { items: [entry], totalCount: 1, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe('');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('cancels a stale history request when switching products', () => {
    const old = http.expectOne(r => r.url === url);
    fixture.componentRef.setInput('product', { ...product, id: 'product-b', code: 'UI-B' });
    fixture.detectChanges();
    expect(old.cancelled).toBeTrue();
    const next = http.expectOne(r => r.url === `${base}/products/product-b/price-history`);
    expect(next.request.params.get('page')).toBe('1');
    next.flush({ success: true, data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 10 } });
    expect(fixture.componentInstance.entries()).toEqual([]);
  });
});
