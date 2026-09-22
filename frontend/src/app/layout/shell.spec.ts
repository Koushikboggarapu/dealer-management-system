import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { provideRouter, Router, RouterModule } from '@angular/router';
import { AuthService, LoginSession } from '../core/auth.service';
import { Shell } from './shell';

@Component({ standalone: true, template: '' })
class TestPage { }

describe('Workspace shell', () => {
  let fixture: ComponentFixture<Shell>;
  let router: Router;
  const session = signal<LoginSession | null>(null);
  const logout = jasmine.createSpy('logout');

  beforeEach(async () => {
    logout.calls.reset();
    session.set({ token: 'test', username: 'admin', role: 'Admin', expiresAt: '2099-01-01T00:00:00Z' });
    await TestBed.configureTestingModule({
      declarations: [Shell],
      imports: [CommonModule, RouterModule, MatButtonModule, TestPage],
      providers: [provideRouter([
        { path: 'admin', component: TestPage },
        { path: 'admin/orders/:id', component: TestPage },
        { path: 'dealer', component: TestPage },
        { path: 'dealer/orders/new', component: TestPage }
      ]), { provide: AuthService, useValue: {
        session, logout, get homePath() { return session()?.role === 'Admin' ? '/admin' : '/dealer'; }
      } }]
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    await router.navigateByUrl('/admin');
    fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());

  it('shows Admin navigation and marks the current page accessibly', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');
    expect(Array.from(links).map(link => link.getAttribute('href'))).toEqual([
      '/admin', '/admin/dealers', '/admin/products', '/admin/orders'
    ]);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(fixture.nativeElement.querySelector('.create-draft')).toBeNull();
    expect(fixture.nativeElement.querySelector('.skip-link').getAttribute('href')).toBe('#main-content');
  });

  it('shows only Dealer navigation and the new-draft action for a Dealer', async () => {
    session.set({ ...session()!, username: 'dealer1', role: 'Dealer' });
    await router.navigateByUrl('/dealer');
    fixture.detectChanges();
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');
    expect(Array.from(links).map(link => link.getAttribute('href'))).toEqual(['/dealer', '/dealer/orders']);
    expect(fixture.nativeElement.querySelector('.create-draft').getAttribute('href')).toBe('/dealer/orders/new');
    expect(fixture.nativeElement.querySelector('.account-details').textContent).toContain('dealer1');
  });

  it('updates the page label for order details and keeps Orders selected', async () => {
    await router.navigateByUrl('/admin/orders/test-order');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.current-page').textContent).toContain('Order details');
    expect(fixture.nativeElement.querySelector('nav [aria-current="page"]').getAttribute('href')).toBe('/admin/orders');
  });

  it('toggles navigation and closes it with Escape', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.menu-toggle');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fixture.nativeElement.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes navigation after routing and preserves logout behavior', async () => {
    fixture.componentInstance.menuOpen.set(true);
    await router.navigateByUrl('/admin/orders/test-order');
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
    fixture.nativeElement.querySelector('.header-account button').click();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('labels a new draft without highlighting the order list', async () => {
    session.set({ ...session()!, username: 'dealer1', role: 'Dealer' });
    await router.navigateByUrl('/dealer/orders/new');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.current-page').textContent).toContain('New draft');
    expect(fixture.nativeElement.querySelector('nav [aria-current="page"]')).toBeNull();
  });
});
