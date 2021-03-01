import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InicioRutaPageRoutingModule } from './inicio-ruta-routing.module';

import { InicioRutaPage } from './inicio-ruta.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InicioRutaPageRoutingModule
  ],
  declarations: [InicioRutaPage]
})
export class InicioRutaPageModule {}
