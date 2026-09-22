import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const isApiRequest = request.url === baseUrl || request.url.startsWith(`${baseUrl}/`);
  if (!isApiRequest || request.url === `${baseUrl}/auth/login`) return next(request);

  const auth = inject(AuthService);
  const token = auth.token;
  const authenticated = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticated).pipe(catchError(error => {
    // An old request must not clear a newer session established since it was sent.
    if (error.status === 401 && token && auth.session()?.token === token) auth.logout(true);
    return throwError(() => error);
  }));
};
