import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export interface PendingEditor {
  hasUnsavedChanges(): boolean;
  isSaving(): boolean;
}
export const pendingChangesGuard: CanDeactivateFn<PendingEditor> = component => {
  const auth = inject(AuthService);
  if (!auth.token) return true;
  if (component.isSaving()) return false;
  return !component.hasUnsavedChanges() || window.confirm('Discard unsaved changes?');
};
export const dealerActionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token && auth.session()?.role === 'Dealer' ? true : inject(Router).parseUrl(auth.homePath);
};
