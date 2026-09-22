import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { errorMessage } from '../../core/api';
import { PendingEditor } from '../../core/edit.guards';
import { ManagementApi } from '../../core/management-api';
import { Dealer } from '../../core/order-models';
import { PagedPage } from '../../shared/paged-page';

@Component({ selector: 'app-dealers', standalone: false, templateUrl: './dealers.html' })
export class Dealers extends PagedPage<Dealer> implements PendingEditor {
  private readonly api = inject(ManagementApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly selected = signal<Dealer | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly fields = [
    { key: 'code', label: 'Dealer code', max: 30, type: 'text' },
    { key: 'companyName', label: 'Company name', max: 150, type: 'text' },
    { key: 'contactPerson', label: 'Contact person', max: 100, type: 'text' },
    { key: 'email', label: 'Email', max: 254, type: 'email' },
    { key: 'phone', label: 'Phone', max: 30, type: 'tel' }
  ] as const;
  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/\S/)]],
    companyName: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    contactPerson: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/\S/)]],
    address: ['', [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)]],
    isActive: true
  });

  protected fetchPage() { return this.api.dealers(this.appliedSearch, this.pageIndex() + 1, this.pageSize()); }
  hasUnsavedChanges(): boolean { return this.form.dirty; }
  isSaving(): boolean { return this.saving(); }

  edit(dealer: Dealer | null): void {
    if (this.saving() || (this.form.dirty && !window.confirm('Discard unsaved dealer changes?'))) return;
    this.selected.set(dealer);
    this.formError.set('');
    this.form.reset(dealer ?? {
      code: '', companyName: '', contactPerson: '', email: '', phone: '', address: '', isActive: true
    });
  }
  save(): void {
    this.form.markAllAsTouched();
    if (this.saving() || this.form.invalid) return;
    this.saving.set(true);
    this.formError.set('');
    this.message.set('');
    this.api.saveDealer(this.selected()?.id ?? null, this.form.getRawValue()).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))
    ).subscribe({
      next: dealer => {
        this.selected.set(dealer);
        this.form.reset(dealer);
        this.message.set('Dealer saved.');
        this.load();
      },
      error: error => this.formError.set(errorMessage(error))
    });
  }
}
