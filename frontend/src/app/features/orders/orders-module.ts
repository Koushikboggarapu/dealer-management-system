import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { dealerActionGuard, pendingChangesGuard } from '../../core/edit.guards';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { OrderList } from './order-list';
import { OrderDetails } from './order-details';
import { OrderEditor } from './order-editor';

@NgModule({
  declarations: [OrderList, OrderDetails, OrderEditor],
  imports: [FeatureUiModule, RouterModule.forChild([
    { path: '', pathMatch: 'full', component: OrderList },
    { path: 'new', component: OrderEditor, canActivate: [dealerActionGuard], canDeactivate: [pendingChangesGuard] },
    { path: ':id/edit', component: OrderEditor, canActivate: [dealerActionGuard], canDeactivate: [pendingChangesGuard] },
    { path: ':id', component: OrderDetails, canDeactivate: [pendingChangesGuard] }
  ])]
})
export class OrdersModule { }
