import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { OrderDetails as OrderData } from '../../core/order-models';
import { OrderDetails } from './order-details';

const base = 'https://localhost:7020/api';
const submitted: OrderData = {
  id: 'order-id', dealerId: 'dealer-id', companyName: 'Demo Dealer', status: 'Submitted',
  createdAt: '2026-01-01T00:00:00Z', total: 120,
  items: [{ productId: 'chair-id', productName: 'Chair', quantity: 1, unitPrice: 120, total: 120 }], history: []
};

describe('OrderDetails actions', () => {
  let fixture: ComponentFixture<OrderDetails>;
  let page: OrderDetails;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderDetails],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: base },
        { provide: AuthService, useValue: { session: () => ({ role: 'Admin' }), token: 'test-token' } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'order-id' })) } }]
    }).overrideComponent(OrderDetails, { set: { template: '' } }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderDetails);
    page = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne(`${base}/orders/order-id`).flush({ success: true, data: submitted });
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('requires a nonblank rejection reason and sends the confirmed action', () => {
    page.selectAction('Rejected');
    page.confirm();
    http.expectNone(`${base}/orders/order-id/status`);
    page.remarks.setValue('   ');
    page.confirm();
    http.expectNone(`${base}/orders/order-id/status`);
    page.remarks.setValue(' Cannot fulfill order ');
    page.confirm();
    const request = http.expectOne(`${base}/orders/order-id/status`);
    expect(request.request.body).toEqual({ status: 'Rejected', remarks: 'Cannot fulfill order' });
    request.flush({ success: true, data: { ...submitted, status: 'Rejected' } });
    expect(page.order()?.status).toBe('Rejected');
    expect(page.actions()).toEqual([]);
  });
  it('does not issue duplicate actions while an approval is pending', () => {
    page.selectAction('Approved');
    page.confirm();
    page.confirm();
    const requests = http.match(`${base}/orders/order-id/status`);
    expect(requests.length).toBe(1);
    requests[0].flush({ success: true, data: { ...submitted, status: 'Approved' } });
    expect(page.actions()).toEqual(['Dispatched']);
  });
  it('requires reload after a conflict and uses the refreshed status', () => {
    page.selectAction('Approved');
    page.confirm();
    http.expectOne(`${base}/orders/order-id/status`).flush({ success: false, message: 'Concurrent update.', data: null },
      { status: 409, statusText: 'Conflict' });
    expect(page.refreshRequired()).toBeTrue();
    page.confirm();
    http.expectNone(`${base}/orders/order-id/status`);
    page.load();
    http.expectOne(`${base}/orders/order-id`).flush({ success: true, data: { ...submitted, status: 'Approved' } });
    expect(page.refreshRequired()).toBeFalse();
    expect(page.actions()).toEqual(['Dispatched']);
  });
});
