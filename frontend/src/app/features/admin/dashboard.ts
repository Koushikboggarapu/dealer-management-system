import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { finalize, Subscription } from 'rxjs';
import { ApiService, Dashboard as DashboardData, errorMessage, LowStockProduct } from '../../core/api';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  template: `
    <section class="page">
      <div class="page-heading">
        <div><span class="eyebrow">OPERATIONS OVERVIEW</span><h1>Admin dashboard</h1><p class="page-description">Your dealer network, order pipeline and inventory at a glance.</p></div>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">Refresh</button>
      </div>
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading dashboard" /> }
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      @if (data(); as dashboard) {
        <div class="card-grid metric-grid">
          <mat-card class="metric-card"><mat-card-content>
            <h2>Dealer network</h2><p class="metric">{{ dashboard.dealerCount }}</p><span class="metric-caption">Total registered profiles</span>
          </mat-card-content></mat-card>
          @for (entry of dashboard.orderCounts | keyvalue; track entry.key) {
            <mat-card class="metric-card"><mat-card-content>
              <h2><span class="status-badge" [attr.data-status]="entry.key">{{ entry.key }}</span></h2>
              <p class="metric">{{ entry.value }}</p><span class="metric-caption">Orders currently in this status</span>
            </mat-card-content></mat-card>
          }
        </div>
      }
      <div class="actions"><a mat-stroked-button routerLink="/admin/dealers">Manage dealers</a><a mat-stroked-button routerLink="/admin/products">Manage products</a><a mat-flat-button routerLink="/admin/orders">Review orders</a></div>
      <section class="editor-card" aria-labelledby="low-stock-title">
        <div class="page-heading">
          <h2 id="low-stock-title">Low Stock Products</h2>
          <button mat-stroked-button type="button" (click)="refreshLowStock()" [disabled]="loadingLowStock()">Refresh low stock</button>
        </div>
        <p class="muted">Active products with available stock of 5 or fewer, including zero. Refresh to see inventory changes.</p>
        @if (loadingLowStock()) { <mat-progress-bar mode="indeterminate" aria-label="Loading low-stock products" /> }
        @if (lowStockError()) { <p class="error-message" role="alert">{{ lowStockError() }}</p> }
        @if (!loadingLowStock() && !lowStockError()) {
          <p role="status">{{ lowStockTotal() }} low-stock products</p>
          @if (lowStockTotal() === 0) { <p>No active products have stock of 5 or fewer.</p> }
        }
        @if (lowStockProducts().length > 0) {
          <div class="table-scroll"><table class="data-table">
            <caption class="visually-hidden">Low stock inventory</caption>
            <thead><tr><th>Code</th><th>Product</th><th>Available stock</th><th>Alert</th><th>Action</th></tr></thead>
            <tbody>@for (product of lowStockProducts(); track product.id) {
              <tr><td>{{ product.code }}</td><td>{{ product.name }}</td><td>{{ product.availableStock }}</td>
                <td><span class="status-badge" [attr.data-status]="product.availableStock === 0 ? 'Out of stock' : 'Low stock'">{{ product.availableStock === 0 ? 'Out of stock' : 'Low stock' }}</span></td>
                <td><a mat-button routerLink="/admin/products">Manage products</a></td></tr>
            }</tbody>
          </table></div>
        }
        <mat-paginator [length]="lowStockTotal()" [pageIndex]="lowStockPageIndex()" [pageSize]="lowStockPageSize()"
          [pageSizeOptions]="[10, 20, 50]" (page)="changeLowStockPage($event)" aria-label="Low stock pages" />
      </section>
    </section>
  `
})
export class Dashboard implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private lowStockRequest?: Subscription;
  readonly data = signal<DashboardData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly lowStockProducts = signal<LowStockProduct[]>([]);
  readonly lowStockTotal = signal(0);
  readonly lowStockPageIndex = signal(0);
  readonly lowStockPageSize = signal(10);
  readonly loadingLowStock = signal(false);
  readonly lowStockError = signal('');

  ngOnInit(): void { this.load(); }

  load(): void {
    if (this.loading()) return;
    this.refreshLowStock();
    this.loading.set(true);
    this.error.set('');
    this.api.dashboard().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: data => this.data.set(data), error: error => this.error.set(errorMessage(error)) });
  }
  refreshLowStock(): void {
    this.lowStockPageIndex.set(0);
    this.loadLowStock();
  }
  changeLowStockPage(event: PageEvent): void {
    this.lowStockPageIndex.set(event.pageIndex);
    this.lowStockPageSize.set(event.pageSize);
    this.loadLowStock();
  }
  private loadLowStock(): void {
    this.lowStockRequest?.unsubscribe();
    this.loadingLowStock.set(true);
    this.lowStockError.set('');
    this.lowStockProducts.set([]);
    this.lowStockRequest = this.api.lowStockProducts(this.lowStockPageIndex() + 1, this.lowStockPageSize()).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingLowStock.set(false))
    ).subscribe({
      next: page => {
        this.lowStockTotal.set(page.totalCount);
        if (page.items.length === 0 && this.lowStockPageIndex() > 0) {
          this.refreshLowStock();
          return;
        }
        this.lowStockProducts.set(page.items);
      },
      error: error => { this.lowStockTotal.set(0); this.lowStockError.set(errorMessage(error)); }
    });
  }
}
