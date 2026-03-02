import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { LoginComponent } from './features/auth/components/login.component';
import { RegisterComponent } from './features/auth/components/register.component';
import { CreateOrderComponent } from './features/client/components/create-order.component';
import { ViewCatalogComponent } from './features/client/components/view-catalog.component';
import { AdminOrdersComponent } from './features/admin/components/admin-orders.component';
import { DeliveryDashboardComponent } from './features/delivery/components/delivery-dashboard.component';
import { AdminGuard } from './core/guards/admin.guard';
import { DeliveryGuard } from './core/guards/delivery.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'client/create-order', component: CreateOrderComponent },
  { path: 'client/catalog', component: ViewCatalogComponent },
  { path: 'client/orders', component: CreateOrderComponent },
  { path: 'admin/orders', component: AdminOrdersComponent, canActivate: [AdminGuard] },
  { path: 'delivery/dashboard', component: DeliveryDashboardComponent, canActivate: [DeliveryGuard] },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    CreateOrderComponent,
    ViewCatalogComponent,
    AdminOrdersComponent,
    DeliveryDashboardComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [AdminGuard, DeliveryGuard],
  bootstrap: [AppComponent]
})
export class AppModule { }
