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
import { RestaurantMenuComponent } from './features/restaurant/components/restaurant-menu.component';
import { AdminGuard } from './core/guards/admin.guard';
import { DeliveryGuard } from './core/guards/delivery.guard';
import { RestaurantGuard } from './core/guards/restaurant.guard';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'client/create-order', component: CreateOrderComponent },
  { path: 'client/catalog', component: ViewCatalogComponent },
  { path: 'client/orders', component: CreateOrderComponent },
  { path: 'admin/orders', component: AdminOrdersComponent, canActivate: [AdminGuard] },
  { path: 'delivery/dashboard', component: DeliveryDashboardComponent, canActivate: [DeliveryGuard] },
  { path: 'restaurant/menu', component: RestaurantMenuComponent, canActivate: [RestaurantGuard] },
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
    DeliveryDashboardComponent,
    RestaurantMenuComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [AdminGuard, DeliveryGuard, RestaurantGuard],
  bootstrap: [AppComponent]
})
export class AppModule { }
