import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL, Product } from '../../core/api';
import { OrderEditor } from './order-editor';

const base = 'https://localhost:7020/api';
const chair: Product = { id: 'chair-id', code: 'P1', name: 'Chair', category: 'Furniture', unitPrice: 120,
  availableStock: 5, isActive: true, rowVersion: 'AAAAAAAAB+Y=' };

describe('OrderEditor', () => {
  let fixture: ComponentFixture<OrderEditor>;
  let editor: OrderEditor;
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OrderEditor],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})), snapshot: { queryParamMap: convertToParamMap({}) } } }]
    }).overrideComponent(OrderEditor, { set: { template: '' } }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderEditor);
    editor = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne(r => r.url === `${base}/products`).flush({ success: true, data: { items: [chair], totalCount: 1, pageNumber: 1, pageSize: 10 } });
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('merges duplicate selections and sends only product IDs and quantities', () => {
    editor.add(chair);
    editor.add(chair);
    expect(editor.lines.length).toBe(1);
    expect(editor.lines.at(0).controls.quantity.value).toBe(2);
    editor.lines.at(0).controls.unitPrice.setValue(999);
    editor.save();
    const request = http.expectOne(`${base}/orders`);
    expect(request.request.body).toEqual({ items: [{ productId: 'chair-id', quantity: 2 }] });
    request.flush({ success: true, data: { id: 'order-id', total: 240 } });
    expect(editor.form.pristine).toBeTrue();
    expect(editor.savedTotal()).toBe(240);
  });
  it('blocks zero, negative and fractional quantities', () => {
    editor.add(chair);
    for (const quantity of [0, -1, 1.5]) {
      editor.lines.at(0).controls.quantity.setValue(quantity);
      editor.save();
      expect(editor.form.invalid).toBeTrue();
      http.expectNone(`${base}/orders`);
    }
  });
  it('removes items and marks the draft as having unsaved changes', () => {
    editor.add(chair);
    editor.form.markAsPristine();
    editor.remove(0);
    expect(editor.lines.length).toBe(0);
    expect(editor.hasUnsavedChanges()).toBeTrue();
  });
  it('preserves the draft after a backend validation error', () => {
    editor.add(chair);
    editor.save();
    http.expectOne(`${base}/orders`).flush({ success: false, message: 'Inactive dealers cannot place orders.', data: null },
      { status: 403, statusText: 'Forbidden' });
    expect(editor.lines.length).toBe(1);
    expect(editor.hasUnsavedChanges()).toBeTrue();
    expect(editor.saving()).toBeFalse();
    expect(editor.error()).toContain('Inactive dealers');
  });
});
