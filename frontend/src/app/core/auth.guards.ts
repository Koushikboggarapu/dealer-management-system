import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token ? true : inject(Router).parseUrl('/login');
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token ? inject(Router).parseUrl(auth.homePath) : true;
};

export const roleGuard: CanMatchFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token) return router.parseUrl('/login');
  return auth.session()?.role === route.data?.['role'] ? true : router.parseUrl(auth.homePath);
};
