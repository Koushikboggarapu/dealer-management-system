import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api';
import { Dealer } from '../../core/order-models';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { Dealers } from './dealers';

const base = 'https://localhost:7020/api';
const dealers: Dealer[] = [
  { id: 'dealer-1', code: 'DLR001', companyName: 'Demo Dealer', contactPerson: 'Contact One',
    email: 'dealer1@example.com', phone: '1234567890', address: 'Address One', isActive: true },
  { id: 'dealer-2', code: 'DLR002', companyName: 'Second Demo Dealer', contactPerson: 'Contact Two',
    email: 'dealer2@example.com', phone: '1234567891', address: 'Address Two', isActive: true }
];

describe('Dealers search form', () => {
  let fixture: ComponentFixture<Dealers>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Dealers],
      imports: [FeatureUiModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: base }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dealers);
    fixture.detectChanges();
    http.expectOne(r => r.url === `${base}/dealers`).flush({
      success: true, data: { items: dealers, totalCount: 2, pageNumber: 1, pageSize: 10 }
    });
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); http.verify(); });

  function submitSearch(value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.search-form input');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form: HTMLFormElement = fixture.nativeElement.querySelector('.search-form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('submits the entered search and renders only the matching server results', () => {
    fixture.componentInstance.pageIndex.set(2);
    submitSearch(' DLR002 ');
    const request = http.expectOne(r => r.url === `${base}/dealers`);
    expect(request.request.params.get('search')).toBe('DLR002');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({ success: true, data: { items: [dealers[1]], totalCount: 1, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    const rows: NodeListOf<HTMLTableRowElement> = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('DLR002');
    expect(rows[0].textContent).not.toContain('DLR001');
    expect(fixture.componentInstance.total()).toBe(1);
  });

  it('clears the filter when an empty search is submitted', () => {
    submitSearch('DLR002');
    http.expectOne(r => r.url === `${base}/dealers`).flush({
      success: true, data: { items: [dealers[1]], totalCount: 1, pageNumber: 1, pageSize: 10 }
    });
    submitSearch('   ');
    const request = http.expectOne(r => r.url === `${base}/dealers`);
    expect(request.request.params.has('search')).toBeFalse();
    request.flush({ success: true, data: { items: dealers, totalCount: 2, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows no dealers when the server returns no matches', () => {
    submitSearch('DOES-NOT-EXIST');
    const request = http.expectOne(r => r.url === `${base}/dealers`);
    expect(request.request.params.get('search')).toBe('DOES-NOT-EXIST');
    request.flush({ success: true, data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 10 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No dealers found.');
  });
});
