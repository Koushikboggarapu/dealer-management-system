import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { Dashboard } from './dashboard';

const base = 'https://localhost:7020/api';
const lowStockUrl = `${base}/dashboard/low-stock`;
const products = [
  { id: 'zero', code: 'ZERO', name: 'Empty product', availableStock: 0 },
  { id: 'five', code: 'FIVE', name: 'Low product', availableStock: 5 }
];

function page(items = products, totalCount = items.length, pageNumber = 1) {
  return { success: true, data: { items, totalCount, pageNumber, pageSize: 10 } };
}

describe('Dashboard low stock', () => {
  let fixture: ComponentFixture<Dashboard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Dashboard],
      imports: [FeatureUiModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: API_BASE_URL, useValue: base }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    http.expectOne(`${base}/dashboard`).flush({ success: true, data: { dealerCount: 2, orderCounts: { Draft: 1 } } });
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('loads the first page and displays low-stock and out-of-stock alerts', () => {
    expect(fixture.componentInstance.loadingLowStock()).toBeTrue();
    const request = http.expectOne(r => r.url === lowStockUrl);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('10');
    request.flush(page());
    fixture.detectChanges();
    const section: HTMLElement = fixture.nativeElement.querySelector('[aria-labelledby="low-stock-title"]');
    expect(section.textContent).toContain('2 low-stock products');
    const rows = section.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Out of stock');
    expect(rows[1].textContent).toContain('Low stock');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/admin/products');
    expect(fixture.componentInstance.loadingLowStock()).toBeFalse();
    expect(fixture.componentInstance.data()?.dealerCount).toBe(2);
  });

  it('shows an empty state only after a successful empty response', () => {
    expect(fixture.nativeElement.textContent).not.toContain('No active products have stock');
    http.expectOne(r => r.url === lowStockUrl).flush(page([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No active products have stock of 5 or fewer.');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('requests server pagination rather than filtering a catalog page', () => {
    http.expectOne(r => r.url === lowStockUrl).flush(page(products, 11));
    fixture.componentInstance.changeLowStockPage({ pageIndex: 1, pageSize: 10, length: 11 });
    const next = http.expectOne(r => r.url === lowStockUrl);
    expect(next.request.params.get('page')).toBe('2');
    expect(next.request.params.get('size')).toBe('10');
    next.flush(page([products[1]], 11, 2));
    fixture.detectChanges();
    expect(fixture.componentInstance.lowStockPageIndex()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('refreshes inventory and counts with the main dashboard Refresh button', () => {
    http.expectOne(r => r.url === lowStockUrl).flush(page());
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    const request = http.expectOne(r => r.url === lowStockUrl);
    expect(request.request.params.get('page')).toBe('1');
    request.flush(page([]));
    http.expectOne(`${base}/dashboard`).flush({ success: true, data: { dealerCount: 2, orderCounts: { Approved: 1 } } });
    fixture.detectChanges();
    expect(fixture.componentInstance.lowStockTotal()).toBe(0);
    expect(fixture.componentInstance.data()?.orderCounts['Approved']).toBe(1);
  });

  it('shows a low-stock failure separately from counts and allows retry', () => {
    http.expectOne(r => r.url === lowStockUrl).flush({ success: false, message: 'Access denied.', data: null },
      { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.componentInstance.data()?.dealerCount).toBe(2);
    expect(fixture.componentInstance.loadingLowStock()).toBeFalse();
    const section: HTMLElement = fixture.nativeElement.querySelector('[aria-labelledby="low-stock-title"]');
    expect(section.querySelector('[role="alert"]')?.textContent).toContain('Access denied');
    expect(section.textContent).not.toContain('No active products have stock');
    section.querySelector('button')!.click();
    http.expectOne(r => r.url === lowStockUrl).flush(page());
    fixture.detectChanges();
    expect(fixture.componentInstance.lowStockError()).toBe('');
    expect(section.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('cancels an older page request when another page is requested', () => {
    const old = http.expectOne(r => r.url === lowStockUrl);
    fixture.componentInstance.changeLowStockPage({ pageIndex: 1, pageSize: 10, length: 11 });
    expect(old.cancelled).toBeTrue();
    http.expectOne(r => r.url === lowStockUrl).flush(page([products[1]], 11, 2));
    expect(fixture.componentInstance.lowStockProducts()).toEqual([products[1]]);
  });

  it('returns to the first page if inventory changes empty the current page', () => {
    http.expectOne(r => r.url === lowStockUrl).flush(page(products, 11));
    fixture.componentInstance.changeLowStockPage({ pageIndex: 1, pageSize: 10, length: 11 });
    http.expectOne(r => r.url === lowStockUrl).flush(page([], 1, 2));
    const first = http.expectOne(r => r.url === lowStockUrl);
    expect(first.request.params.get('page')).toBe('1');
    first.flush(page([products[1]], 1));
    expect(fixture.componentInstance.lowStockPageIndex()).toBe(0);
    expect(fixture.componentInstance.lowStockTotal()).toBe(1);
    expect(fixture.componentInstance.loadingLowStock()).toBeFalse();
  });
});
