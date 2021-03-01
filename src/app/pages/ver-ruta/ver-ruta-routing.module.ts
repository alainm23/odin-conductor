import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VerRutaPage } from './ver-ruta.page';

const routes: Routes = [
  {
    path: '',
    component: VerRutaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VerRutaPageRoutingModule {}
