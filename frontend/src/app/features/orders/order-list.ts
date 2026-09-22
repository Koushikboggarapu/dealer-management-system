import { Component, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ManagementApi } from '../../core/management-api';
import { ORDER_STATUSES, OrderStatus, OrderSummary } from '../../core/order-models';
import { PagedPage } from '../../shared/paged-page';

@Component({
  selector: 'app-order-list', standalone: false,
  template: `
    <section class="page">
      <div class="page-heading"><div><span class="eyebrow">ORDER WORKSPACE</span><h1>{{ isDealer ? 'My orders' : 'All orders' }}</h1><p class="page-description">{{ isDealer ? 'Track your orders from draft to delivery.' : 'Review submissions and manage every stage of fulfillment.' }}</p></div>
        @if (isDealer) { <a mat-flat-button [routerLink]="[root, 'new']">New draft</a> }
      </div>
      <form class="search-form" (ngSubmit)="search()">
        <mat-form-field appearance="outline"><mat-label>Search order ID or company</mat-label><input matInput [formControl]="searchControl" maxlength="150" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Status</mat-label><mat-select [formControl]="statusControl"><mat-option value="">All statuses</mat-option>@for (status of statuses; track status) { <mat-option [value]="status">{{ status }}</mat-option> }</mat-select></mat-form-field>
        <button mat-flat-button type="submit">Apply filters</button><button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">Refresh</button>
      </form>
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading orders" /> }
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      <div class="table-scroll"><table class="data-table"><caption class="visually-hidden">Orders</caption>
        <thead><tr><th>Order ID</th><th>Company</th><th>Created</th><th>Status</th><th>Total</th><th>Action</th></tr></thead>
        <tbody>@for (order of items(); track order.id) {
          <tr><td class="record-id">{{ order.id }}</td><td>{{ order.companyName }}</td><td>{{ order.createdAt | date:'medium' }}</td><td><span class="status-badge" [attr.data-status]="order.status">{{ order.status }}</span></td><td>{{ order.total | number:'1.2-2' }}</td><td><a mat-button [routerLink]="[root, order.id]">Details</a></td></tr>
        }</tbody>
      </table></div>
      @if (!loading() && !error() && items().length === 0) { <p role="status">No orders match these filters.</p> }
      <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 20, 50]" (page)="changePage($event)" aria-label="Order pages" />
      <p class="muted">Draft totals in this list are the last saved estimates. Open a draft to see its current catalog prices.</p>
    </section>
  `
})
export class OrderList extends PagedPage<OrderSummary> {
  private readonly api = inject(ManagementApi);
  private readonly auth = inject(AuthService);
  readonly statuses = ORDER_STATUSES;
  readonly statusControl = new FormControl<OrderStatus | ''>('', { nonNullable: true });
  private appliedStatus: OrderStatus | '' = '';
  get isDealer(): boolean { return this.auth.session()?.role === 'Dealer'; }
  get root(): string { return this.isDealer ? '/dealer/orders' : '/admin/orders'; }
  override search(): void { this.appliedStatus = this.statusControl.value; super.search(); }
  protected fetchPage() { return this.api.orders(this.appliedSearch, this.appliedStatus, this.pageIndex() + 1, this.pageSize()); }
}
