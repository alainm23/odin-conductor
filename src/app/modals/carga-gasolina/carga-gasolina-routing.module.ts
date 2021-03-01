import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CargaGasolinaPage } from './carga-gasolina.page';

const routes: Routes = [
  {
    path: '',
    component: CargaGasolinaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CargaGasolinaPageRoutingModule {}
