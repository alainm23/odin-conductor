import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChecklistCargaPage } from './checklist-carga.page';

const routes: Routes = [
  {
    path: '',
    component: ChecklistCargaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChecklistCargaPageRoutingModule {}
