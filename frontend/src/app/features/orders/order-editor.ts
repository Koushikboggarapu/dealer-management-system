import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { ApiService, errorMessage, Product } from '../../core/api';
import { PendingEditor } from '../../core/edit.guards';
import { ManagementApi } from '../../core/management-api';
import { OrderItem } from '../../core/order-models';

type LineForm = FormGroup<{
  productId: FormControl<string>;
  productName: FormControl<string>;
  unitPrice: FormControl<number>;
  quantity: FormControl<number>;
}>;

@Component({ selector: 'app-order-editor', standalone: false, templateUrl: './order-editor.html' })
export class OrderEditor implements OnInit, PendingEditor {
  private readonly api = inject(ManagementApi);
  private readonly catalog = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  private productRequest?: Subscription;
  private orderRequest?: Subscription;
  private productPage = 1;
  private appliedSearch = '';
  id: string | null = null;
  readonly lines = new FormArray<LineForm>([]);
  readonly form = new FormGroup({ items: this.lines });
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly products = signal<Product[]>([]);
  readonly productTotal = signal(0);
  readonly productPageIndex = signal(0);
  readonly loadingProducts = signal(false);
  readonly productError = signal('');
  readonly loadingOrder = signal(false);
  readonly ready = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly savedTotal = signal<number | null>(null);

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.savedTotal.set(null));
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.orderRequest?.unsubscribe();
      this.id = params.get('id');
      this.error.set('');
      this.lines.clear();
      this.form.markAsPristine();
      this.savedTotal.set(null);
      this.ready.set(!this.id);
      if (this.id) {
        this.loadingOrder.set(true);
        this.orderRequest = this.api.order(this.id).pipe(takeUntilDestroyed(this.destroyRef),
          finalize(() => this.loadingOrder.set(false))).subscribe({
          next: order => {
            if (order.status !== 'Draft') { this.error.set('Only draft orders can be edited. Return to the order details.'); return; }
            order.items.forEach(item => this.lines.push(this.makeLine(item)));
            this.form.markAsPristine();
            this.savedTotal.set(order.total);
            this.ready.set(true);
          },
          error: error => this.error.set(errorMessage(error))
        });
      }
    });
    this.searchControl.setValue(this.route.snapshot.queryParamMap.get('search') ?? '');
    this.searchProducts();
  }
  hasUnsavedChanges(): boolean { return this.form.dirty; }
  isSaving(): boolean { return this.saving(); }
  estimate(): number {
    return this.lines.controls.reduce((total, line) => {
      const { unitPrice, quantity } = line.getRawValue();
      return total + unitPrice * (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  }
  searchProducts(): void {
    this.appliedSearch = this.searchControl.value.trim();
    this.productPage = 1;
    this.productPageIndex.set(0);
    this.loadProducts();
  }
  changeProductPage(index: number): void {
    this.productPageIndex.set(index);
    this.productPage = index + 1;
    this.loadProducts();
  }
  private loadProducts(): void {
    this.productRequest?.unsubscribe();
    this.loadingProducts.set(true);
    this.productError.set('');
    this.productRequest = this.catalog.products(this.appliedSearch, this.productPage, 10).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingProducts.set(false))
    ).subscribe({
      next: page => { this.products.set(page.items); this.productTotal.set(page.totalCount); },
      error: error => { this.products.set([]); this.productTotal.set(0); this.productError.set(errorMessage(error)); }
    });
  }
  add(product: Product): void {
    if (this.saving() || !this.ready()) return;
    const existing = this.lines.controls.find(line => line.controls.productId.value === product.id);
    if (existing) {
      const current = existing.controls.quantity.value;
      existing.controls.quantity.setValue(Math.min(1000000, (Number.isFinite(current) ? current : 0) + 1));
    } else {
      if (this.lines.length >= 100) { this.error.set('An order can contain at most 100 distinct products.'); return; }
      this.lines.push(this.makeLine({ productId: product.id, productName: product.name,
        quantity: 1, unitPrice: product.unitPrice, total: product.unitPrice }));
    }
    this.form.markAsDirty();
  }
  remove(index: number): void {
    if (this.saving()) return;
    this.lines.removeAt(index);
    this.form.markAsDirty();
  }
  save(): void {
    this.form.markAllAsTouched();
    if (this.saving() || !this.ready() || this.form.invalid || this.lines.length > 100) return;
    this.saving.set(true);
    this.error.set('');
    const items = this.lines.controls.map(line => ({
      productId: line.controls.productId.value, quantity: line.controls.quantity.value
    }));
    this.api.saveDraft(this.id, { items }).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))).subscribe({
      next: order => {
        this.form.markAsPristine();
        this.savedTotal.set(order.total);
        this.saving.set(false);
        void this.router.navigate(['/dealer/orders', order.id], { replaceUrl: true });
      },
      error: error => this.error.set(errorMessage(error))
    });
  }
  private makeLine(item: OrderItem): LineForm {
    return this.fb.group({
      productId: item.productId, productName: item.productName, unitPrice: item.unitPrice,
      quantity: [item.quantity, [Validators.required, Validators.min(1), Validators.max(1000000), Validators.pattern(/^\d+$/)]]
    });
  }
}
