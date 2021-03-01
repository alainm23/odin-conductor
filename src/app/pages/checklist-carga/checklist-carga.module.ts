import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChecklistCargaPageRoutingModule } from './checklist-carga-routing.module';

import { ChecklistCargaPage } from './checklist-carga.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChecklistCargaPageRoutingModule
  ],
  declarations: [ChecklistCargaPage]
})
export class ChecklistCargaPageModule {}
