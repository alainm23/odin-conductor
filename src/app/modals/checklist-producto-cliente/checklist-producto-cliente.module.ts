import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChecklistProductoClientePageRoutingModule } from './checklist-producto-cliente-routing.module';

import { ChecklistProductoClientePage } from './checklist-producto-cliente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChecklistProductoClientePageRoutingModule
  ],
  declarations: [ChecklistProductoClientePage]
})
export class ChecklistProductoClientePageModule {}
