import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ApiService, errorMessage, Product } from '../../core/api';
import { PendingEditor } from '../../core/edit.guards';
import { ManagementApi } from '../../core/management-api';
import { PagedPage } from '../../shared/paged-page';

@Component({ selector: 'app-products', standalone: false, templateUrl: './products.html' })
export class Products extends PagedPage<Product> implements PendingEditor {
  private readonly catalog = inject(ApiService);
  private readonly api = inject(ManagementApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly selected = signal<Product | null>(null);
  readonly historyProduct = signal<Product | null>(null);
  readonly saving = signal(false);
  readonly conflict = signal(false);
  readonly formError = signal('');
  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/\S/)]],
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    category: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    unitPrice: [1, [Validators.required, Validators.min(0.01), Validators.max(99999999.99), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    availableStock: [0, [Validators.required, Validators.min(0), Validators.max(2147483647), Validators.pattern(/^\d+$/)]],
    isActive: true
  });
  protected fetchPage() { return this.catalog.products(this.appliedSearch, this.pageIndex() + 1, this.pageSize()); }
  hasUnsavedChanges(): boolean { return this.form.dirty; }
  isSaving(): boolean { return this.saving(); }

  edit(product: Product | null): void {
    if (this.saving() || (this.form.dirty && !window.confirm('Discard unsaved product changes?'))) return;
    this.selected.set(product);
    this.formError.set('');
    this.conflict.set(false);
    this.form.reset(product ?? { code: '', name: '', category: '', unitPrice: 1, availableStock: 0, isActive: true });
  }
  reloadAfterConflict(): void {
    if (!window.confirm('Discard these edits and reload the latest product list?')) return;
    this.form.markAsPristine();
    this.edit(null);
    this.load();
    this.message.set('Select the product again to edit its latest values.');
  }
  save(): void {
    this.form.markAllAsTouched();
    if (this.saving() || this.form.invalid || this.conflict()) return;
    this.saving.set(true);
    this.formError.set('');
    this.message.set('');
    const selected = this.selected();
    this.api.saveProduct(selected?.id ?? null, {
      ...this.form.getRawValue(), rowVersion: selected?.rowVersion ?? null
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: product => {
        this.selected.set(product);
        this.form.reset(product);
        if (this.historyProduct()?.id === product.id) this.historyProduct.set(product);
        this.message.set('Product saved. Previously submitted order prices remain unchanged.');
        this.load();
      },
      error: error => {
        const message = errorMessage(error);
        this.formError.set(message);
        this.conflict.set(error instanceof HttpErrorResponse && error.status === 409 && /changed|concurren/i.test(message));
      }
    });
  }
}
