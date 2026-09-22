import { Component, DestroyRef, inject, Input, OnChanges, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { finalize, Subscription } from 'rxjs';
import { errorMessage, Product } from '../../core/api';
import { ManagementApi } from '../../core/management-api';
import { ProductPriceHistoryEntry } from '../../core/product-price-history';
import { FeatureUiModule } from '../../shared/feature-ui-module';

@Component({
  selector: 'app-product-price-history',
  standalone: true,
  imports: [FeatureUiModule],
  template: `
    <section class="editor-card" aria-labelledby="price-history-title">
      <div class="page-heading">
        <h2 id="price-history-title">Price history: {{ product.code }} · {{ product.name }}</h2>
        <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">Refresh history</button>
      </div>
      <p class="muted">Successful price changes only, newest first. Earlier changes made before auditing was enabled are not available. Timestamps are shown in your local time.</p>
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading price history" /> }
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      <div class="table-scroll"><table class="data-table">
        <caption class="visually-hidden">Product price history</caption>
        <thead><tr><th>Changed by</th><th>Timestamp</th><th>Old price</th><th>New price</th></tr></thead>
        <tbody>@for (entry of entries(); track entry.id) {
          <tr><td>{{ entry.changedByUsername }}</td><td>{{ entry.changedAt | date:'medium' }}</td>
            <td>{{ entry.oldPrice | number:'1.2-2' }}</td><td>{{ entry.newPrice | number:'1.2-2' }}</td></tr>
        }</tbody>
      </table></div>
      @if (!loading() && !error() && entries().length === 0) { <p role="status">No price changes recorded for this product.</p> }
      <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Price history pages" />
    </section>
  `
})
export class ProductPriceHistory implements OnChanges {
  @Input({ required: true }) product!: Product;
  private readonly api = inject(ManagementApi);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly entries = signal<ProductPriceHistoryEntry[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnChanges(): void { this.pageIndex.set(0); this.load(); }
  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.entries.set([]);
    this.total.set(0);
    this.request = this.api.productPriceHistory(this.product.id, this.pageIndex() + 1, this.pageSize()).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))
    ).subscribe({
      next: page => { this.entries.set(page.items); this.total.set(page.totalCount); },
      error: error => this.error.set(errorMessage(error))
    });
  }
}
