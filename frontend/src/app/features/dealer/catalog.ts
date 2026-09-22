import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { finalize, Subscription } from 'rxjs';
import { ApiService, errorMessage, Product } from '../../core/api';

@Component({
  selector: 'app-catalog',
  standalone: false,
  template: `
    <section class="page">
      <div class="page-heading"><div><span class="eyebrow">YOUR NEXT ORDER STARTS HERE</span><h1>Product catalog</h1><p class="page-description">Explore active products and find what your business needs.</p></div><a mat-flat-button routerLink="/dealer/orders/new">Create draft order</a></div>
      <p class="muted">Prices shown here are current catalog prices.</p>
      <form class="search-form" (ngSubmit)="search()">
        <mat-form-field appearance="outline">
          <mat-label>Search by name, code or category</mat-label>
          <input matInput [formControl]="searchControl" maxlength="150" />
        </mat-form-field>
        <button mat-flat-button type="submit">Search</button>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">Refresh</button>
      </form>
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading products" /> }
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      <div class="card-grid">
        @for (product of products(); track product.id) {
          <mat-card><mat-card-content>
            <div class="product-card-top"><span class="product-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5" /></svg></span><span class="product-category">{{ product.category }}</span></div>
            <h2>{{ product.name }}</h2>
            <p class="record-id">{{ product.code }}</p>
            <p class="product-price"><span class="visually-hidden">Unit price: </span>{{ product.unitPrice | number:'1.2-2' }} <small>/ unit</small></p>
            <div class="product-card-footer"><span>Available stock <strong>{{ product.availableStock }}</strong></span><span class="status-badge" [attr.data-status]="product.availableStock === 0 ? 'Out of stock' : product.availableStock <= 5 ? 'Low stock' : 'Active'">{{ product.availableStock === 0 ? 'Out of stock' : product.availableStock <= 5 ? 'Low stock' : 'In stock' }}</span></div>
          </mat-card-content></mat-card>
        }
      </div>
      @if (!loading() && !error() && products().length === 0) {
        <p role="status">No products match your search.</p>
      }
      <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Product pages" />
      <p class="muted">Create a draft to choose quantities. Prices are captured on submission; stock is deducted only on approval.</p>
    </section>
  `
})
export class Catalog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private appliedSearch = '';
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly products = signal<Product[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void { this.load(); }

  search(): void {
    this.appliedSearch = this.searchControl.value.trim();
    this.pageIndex.set(0);
    this.load();
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.products.set([]);
    this.request = this.api.products(this.appliedSearch, this.pageIndex() + 1, this.pageSize()).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))
    ).subscribe({
      next: page => { this.products.set(page.items); this.total.set(page.totalCount); },
      error: error => { this.total.set(0); this.error.set(errorMessage(error)); }
    });
  }
}
