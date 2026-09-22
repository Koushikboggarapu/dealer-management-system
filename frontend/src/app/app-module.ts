import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Shell } from './layout/shell';
import { authInterceptor } from './core/auth.interceptor';

@NgModule({
  declarations: [App, Shell],
  imports: [BrowserModule, AppRoutingModule, MatToolbarModule, MatButtonModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor]))
  ],
  bootstrap: [App]
})
export class AppModule { }
