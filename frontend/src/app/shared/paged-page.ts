import { DestroyRef, Directive, inject, OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { finalize, Observable, Subscription } from 'rxjs';
import { errorMessage, Page } from '../core/api';

@Directive()
export abstract class PagedPage<T> implements OnInit {
  protected readonly destroyRef = inject(DestroyRef);
  protected appliedSearch = '';
  private listRequest?: Subscription;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  protected abstract fetchPage(): Observable<Page<T>>;
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
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.items.set([]);
    this.listRequest = this.fetchPage().pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))).subscribe({
      next: page => { this.items.set(page.items); this.total.set(page.totalCount); },
      error: error => { this.total.set(0); this.error.set(errorMessage(error)); }
    });
  }
}
