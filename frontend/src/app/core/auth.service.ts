import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs';
import { API_BASE_URL, ApiResponse, unwrap } from './api';

export type Role = 'Admin' | 'Dealer';
export interface LoginSession {
  token: string;
  expiresAt: string;
  username: string;
  role: Role;
}

const STORAGE_KEY = 'dms.session';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly sessionState = signal<LoginSession | null>(null);
  private expirationTimer?: ReturnType<typeof setTimeout>;
  readonly session = this.sessionState.asReadonly();

  constructor() {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (this.validSession(saved)) this.setSession(saved);
      else this.clearSession();
    } catch {
      this.clearSession();
    }
  }

  get token(): string | null {
    const current = this.sessionState();
    return current && Date.parse(current.expiresAt) > Date.now() ? current.token : null;
  }

  get homePath(): string {
    if (!this.token) return '/login';
    return this.sessionState()?.role === 'Admin' ? '/admin' : '/dealer';
  }

  login(username: string, password: string) {
    return this.http.post<ApiResponse<LoginSession>>(`${this.baseUrl}/auth/login`, {
      username: username.trim(), password
    }).pipe(
      map(unwrap),
      tap(session => {
        if (!this.validSession(session)) throw new Error('The server returned an invalid login session.');
        this.setSession(session);
      })
    );
  }

  logout(expired = false): void {
    this.clearSession();
    void this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: expired ? { expired: '1' } : {}
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.expirationTimer);
  }

  private validSession(value: unknown): value is LoginSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<LoginSession>;
    return typeof session.token === 'string' && session.token.length > 0 &&
      typeof session.username === 'string' && session.username.length > 0 &&
      (session.role === 'Admin' || session.role === 'Dealer') &&
      typeof session.expiresAt === 'string' && Date.parse(session.expiresAt) > Date.now();
  }

  private setSession(session: LoginSession): void {
    clearTimeout(this.expirationTimer);
    this.sessionState.set(session);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
    catch { /* Keep the session in memory when browser storage is unavailable. */ }
    this.scheduleExpiration();
  }

  private scheduleExpiration(): void {
    const current = this.sessionState();
    if (!current) return;
    const remaining = Date.parse(current.expiresAt) - Date.now();
    if (remaining <= 0) { this.logout(true); return; }
    this.expirationTimer = setTimeout(() => this.scheduleExpiration(), Math.min(remaining, 2147483647));
  }

  private clearSession(): void {
    clearTimeout(this.expirationTimer);
    this.sessionState.set(null);
    try { sessionStorage.removeItem(STORAGE_KEY); }
    catch { /* Storage may be disabled by the browser. */ }
  }
}
