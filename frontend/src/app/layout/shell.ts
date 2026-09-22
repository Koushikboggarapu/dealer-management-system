import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  standalone: false,
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  @ViewChild('menuToggle') private menuToggle?: ElementRef<HTMLButtonElement>;
  readonly menuOpen = signal(false);
  readonly isAdmin = computed(() => this.auth.session()?.role === 'Admin');
  readonly initials = computed(() => (this.auth.session()?.username ?? 'U').slice(0, 2).toUpperCase());
  private readonly url = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => { this.menuOpen.set(false); return event.urlAfterRedirects; })
  ), { initialValue: this.router.url });
  readonly navigation = computed(() => this.isAdmin() ? [
    { path: '/admin', label: 'Dashboard', exact: true, icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
    { path: '/admin/dealers', label: 'Dealers', exact: false, icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87' },
    { path: '/admin/products', label: 'Products', exact: false, icon: 'M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5' },
    { path: '/admin/orders', label: 'Orders', exact: false, icon: 'M8 3H5v18h14V3h-3 M8 2h8v4H8z M8 11h8 M8 16h6' }
  ] : [
    { path: '/dealer', label: 'Product catalog', exact: true, icon: 'M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5' },
    { path: '/dealer/orders', label: 'My orders', exact: false, icon: 'M8 3H5v18h14V3h-3 M8 2h8v4H8z M8 11h8 M8 16h6' }
  ]);
  readonly pageLabel = computed(() => {
    const path = (this.url() ?? this.router.url).split(/[?#]/)[0] ?? '';
    if (path.endsWith('/orders/new')) return 'New draft';
    if (path.endsWith('/edit')) return 'Edit draft';
    if (/\/orders\/[^/]+$/.test(path)) return 'Order details';
    return this.navigation().find(item => this.isActive(item.path, item.exact))?.label ?? 'Workspace';
  });

  isActive(path: string, exact: boolean): boolean {
    const url = (this.url() ?? this.router.url).split(/[?#]/)[0] ?? '';
    if (url.endsWith('/orders/new')) return false;
    return exact ? url === path : url === path || url.startsWith(path + '/');
  }
  closeMenu(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.menuToggle?.nativeElement.focus();
  }
}
