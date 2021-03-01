import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AlertProductoPageRoutingModule } from './alert-producto-routing.module';

import { AlertProductoPage } from './alert-producto.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AlertProductoPageRoutingModule
  ],
  declarations: [AlertProductoPage]
})
export class AlertProductoPageModule {}
