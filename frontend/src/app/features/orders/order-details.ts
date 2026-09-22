import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { PendingEditor } from '../../core/edit.guards';
import { ManagementApi } from '../../core/management-api';
import { ACTION_LABELS, OrderDetails as OrderData, OrderStatus, permittedActions } from '../../core/order-models';

@Component({ selector: 'app-order-details', standalone: false, templateUrl: './order-details.html' })
export class OrderDetails implements OnInit, PendingEditor {
  private readonly api = inject(ManagementApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private request?: Subscription;
  private id = '';
  readonly order = signal<OrderData | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly refreshRequired = signal(false);
  readonly action = signal<OrderStatus | null>(null);
  readonly labels = ACTION_LABELS;
  readonly remarks = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] });
  readonly actions = computed(() => {
    const order = this.order();
    const role = this.auth.session()?.role;
    return order && role ? permittedActions(role, order.status) : [];
  });
  get isDealer(): boolean { return this.auth.session()?.role === 'Dealer'; }
  get root(): string { return this.isDealer ? '/dealer/orders' : '/admin/orders'; }
  hasUnsavedChanges(): boolean { return !!this.action() && this.remarks.dirty; }
  isSaving(): boolean { return this.saving(); }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.id = params.get('id') ?? '';
      this.message.set('');
      this.load();
    });
  }
  load(): void {
    if (this.saving()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.order.set(null);
    this.cancelAction();
    this.request = this.api.order(this.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: order => { this.order.set(order); this.refreshRequired.set(false); }, error: error => this.error.set(errorMessage(error)) });
  }
  selectAction(status: OrderStatus): void {
    if (this.saving() || this.refreshRequired() || !this.actions().includes(status)) return;
    this.action.set(status);
    this.error.set('');
    this.remarks.reset('');
    this.remarks.setValidators(status === 'Rejected'
      ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)] : [Validators.maxLength(1000)]);
    this.remarks.updateValueAndValidity();
  }
  cancelAction(): void { this.action.set(null); this.remarks.reset(''); }
  confirm(): void {
    const status = this.action();
    this.remarks.markAsTouched();
    if (!status || this.saving() || this.remarks.invalid || this.refreshRequired() || !this.actions().includes(status)) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.transition(this.id, status, this.remarks.value.trim() || null).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))
    ).subscribe({
      next: order => { this.order.set(order); this.cancelAction(); this.message.set(`Order is now ${order.status}.`); },
      error: error => {
        this.error.set(errorMessage(error));
        // A conflict or lost response may mean the displayed status is stale; do not blindly retry.
        this.refreshRequired.set(true);
      }
    });
  }
}
