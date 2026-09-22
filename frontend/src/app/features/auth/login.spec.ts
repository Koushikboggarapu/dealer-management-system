import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { AuthService, LoginSession } from '../../core/auth.service';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { Login } from './login';

describe('Redesigned login', () => {
  let fixture: ComponentFixture<Login>;
  let login: jasmine.Spy;
  let router: Router;

  beforeEach(async () => {
    login = jasmine.createSpy('login');
    await TestBed.configureTestingModule({
      declarations: [Login],
      imports: [FeatureUiModule],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: { login, homePath: '/admin' } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ expired: '1' }) } } }]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());

  it('shows the brand in a top header with one login form and no promotional panel', () => {
    const header: HTMLElement = fixture.nativeElement.querySelector('header.login-header');
    expect(header.textContent).toContain('Dealer Management');
    expect(header.textContent).toContain('OPERATIONS WORKSPACE');
    expect(fixture.nativeElement.querySelectorAll('main form').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.brand-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.workflow-preview')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Moving together');
  });

  it('keeps validation, expiry feedback and accessible password visibility', () => {
    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Your session expired');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Show password"]');
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="password"]').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(login).not.toHaveBeenCalled();
  });

  it('submits credentials once, shows loading and routes on success', () => {
    const response = new Subject<LoginSession>();
    login.and.returnValue(response);
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'password' });
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(login).toHaveBeenCalledOnceWith('admin', 'password');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    response.next({ token: 'test', username: 'admin', role: 'Admin', expiresAt: '2099-01-01T00:00:00Z' });
    response.complete();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin', { replaceUrl: true });
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
  });

  it('shows API errors without leaving the login page', () => {
    login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401,
      error: { message: 'Invalid username or password.' } })));
    fixture.componentInstance.form.setValue({ username: 'admin', password: 'wrong' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid username or password');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
