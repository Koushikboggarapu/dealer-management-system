import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { pendingChangesGuard } from '../../core/edit.guards';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { Dashboard } from './dashboard';
import { Dealers } from './dealers';
import { Products } from './products';
import { ProductPriceHistory } from './product-price-history';

@NgModule({
  declarations: [Dashboard, Dealers, Products],
  imports: [FeatureUiModule, ProductPriceHistory, RouterModule.forChild([
    { path: '', pathMatch: 'full', component: Dashboard },
    { path: 'dealers', component: Dealers, canDeactivate: [pendingChangesGuard] },
    { path: 'products', component: Products, canDeactivate: [pendingChangesGuard] },
    { path: 'orders', loadChildren: () => import('../orders/orders-module').then(m => m.OrdersModule) }
  ])]
})
export class AdminModule { }
