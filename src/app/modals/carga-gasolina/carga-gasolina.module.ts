import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CargaGasolinaPageRoutingModule } from './carga-gasolina-routing.module';

import { CargaGasolinaPage } from './carga-gasolina.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    CargaGasolinaPageRoutingModule
  ],
  declarations: [CargaGasolinaPage]
})
export class CargaGasolinaPageModule {}
