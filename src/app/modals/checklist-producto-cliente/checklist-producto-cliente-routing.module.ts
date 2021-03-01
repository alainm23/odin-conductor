import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChecklistProductoClientePage } from './checklist-producto-cliente.page';

const routes: Routes = [
  {
    path: '',
    component: ChecklistProductoClientePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChecklistProductoClientePageRoutingModule {}
