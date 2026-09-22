import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { API_BASE_URL } from './api';
import { AuthService, LoginSession, Role } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { authGuard, guestGuard, roleGuard } from './auth.guards';

const api = 'https://localhost:7020/api';
const storedSession = (role: Role = 'Dealer', token = 'test-token'): LoginSession => ({
  token, role, username: role === 'Admin' ? 'admin' : 'dealer1',
  expiresAt: new Date(Date.now() + 3600000).toISOString()
});

describe('Authentication', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.removeItem('dms.session');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(), { provide: API_BASE_URL, useValue: api }]
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('dms.session');
  });

  function login(role: Role = 'Dealer', token = 'test-token'): AuthService {
    const auth = TestBed.inject(AuthService);
    auth.login(' dealer1 ', 'password').subscribe();
    const request = http.expectOne(`${api}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'dealer1', password: 'password' });
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ success: true, message: 'Success', data: storedSession(role, token) });
    return auth;
  }

  it('saves successful login and routes each role to its home', () => {
    const auth = login();
    expect(auth.token).toBe('test-token');
    expect(auth.homePath).toBe('/dealer');
    expect(JSON.parse(sessionStorage.getItem('dms.session')!).role).toBe('Dealer');
    login('Admin', 'admin-token');
    expect(auth.homePath).toBe('/admin');
  });

  it('does not create a session for rejected credentials', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('dealer1', 'wrong').subscribe({
      next: () => fail('Login must fail'),
      error: error => expect(error.status).toBe(401)
    });
    http.expectOne(`${api}/auth/login`).flush({ success: false, message: 'Invalid username or password.', data: null },
      { status: 401, statusText: 'Unauthorized' });
    expect(auth.token).toBeNull();
  });

  it('restores a valid session after a reload', () => {
    sessionStorage.setItem('dms.session', JSON.stringify(storedSession('Admin')));
    expect(TestBed.inject(AuthService).homePath).toBe('/admin');
  });

  it('discards expired stored sessions', () => {
    sessionStorage.setItem('dms.session', JSON.stringify({ ...storedSession(), expiresAt: '2000-01-01T00:00:00Z' }));
    expect(TestBed.inject(AuthService).token).toBeNull();
    expect(sessionStorage.getItem('dms.session')).toBeNull();
  });

  it('discards malformed stored sessions without crashing', () => {
    sessionStorage.setItem('dms.session', 'invalid-json');
    expect(TestBed.inject(AuthService).token).toBeNull();
  });

  it('clears the session on logout', () => {
    const auth = login();
    auth.logout();
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem('dms.session')).toBeNull();
    expect(router.navigate).toHaveBeenCalled();
  });

  it('automatically signs out at expiry', fakeAsync(() => {
    const auth = login();
    tick(3600000);
    expect(auth.session()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true, queryParams: { expired: '1' }
    });
  }));

  it('attaches the JWT only to this API', () => {
    login();
    const client = TestBed.inject(HttpClient);
    client.get(`${api}/products`).subscribe();
    const apiRequest = http.expectOne(`${api}/products`);
    expect(apiRequest.request.headers.get('Authorization')).toBe('Bearer test-token');
    apiRequest.flush({});
    client.get('https://example.invalid/api/products').subscribe();
    const external = http.expectOne('https://example.invalid/api/products');
    expect(external.request.headers.has('Authorization')).toBeFalse();
    external.flush({});
  });

  it('signs out on an API 401 but not on a 403', () => {
    const auth = login();
    const client = TestBed.inject(HttpClient);
    client.get(`${api}/dashboard`).subscribe({ error: () => undefined });
    http.expectOne(`${api}/dashboard`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(auth.token).toBe('test-token');
    client.get(`${api}/products`).subscribe({ error: () => undefined });
    http.expectOne(`${api}/products`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token).toBeNull();
  });

  it('does not clear a new session when an older request returns 401', () => {
    const auth = login();
    TestBed.inject(HttpClient).get(`${api}/products`).subscribe({ error: () => undefined });
    const oldRequest = http.expectOne(`${api}/products`);
    login('Admin', 'new-token');
    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.token).toBe('new-token');
  });

  it('redirects unauthenticated navigation to login', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('blocks a Dealer from matching the Admin route', () => {
    login();
    const denied = TestBed.runInInjectionContext(() => roleGuard({ data: { role: 'Admin' } }, []));
    expect((denied as UrlTree).toString()).toBe('/dealer');
    const allowed = TestBed.runInInjectionContext(() => roleGuard({ data: { role: 'Dealer' } }, []));
    expect(allowed).toBeTrue();
  });

  it('redirects an authenticated user away from the login page', () => {
    login('Admin');
    const result = TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect((result as UrlTree).toString()).toBe('/admin');
  });
});
