import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FeatureUiModule } from '../../shared/feature-ui-module';
import { Catalog } from './catalog';

@NgModule({
  declarations: [Catalog],
  imports: [FeatureUiModule, RouterModule.forChild([
    { path: '', pathMatch: 'full', component: Catalog },
    { path: 'orders', loadChildren: () => import('../orders/orders-module').then(m => m.OrdersModule) }
  ])]
})
export class DealerModule { }
