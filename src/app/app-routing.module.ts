import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './services/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home', pathMatch: 'full'
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadChildren: () => import ('./home/home.module').then ( m => m.HomePageModule)
  },
  {
    path: 'login',
    loadChildren: () => import ('./pages/login/login.module').then ( m => m.LoginPageModule)
  },
  {
    path: 'cardex/:id/:tipo',
    loadChildren: () => import('./pages/cardex/cardex.module').then( m => m.CardexPageModule)
  },
  {
    path: 'ver-ruta/:id/:tipo',
    loadChildren: () => import('./pages/ver-ruta/ver-ruta.module').then( m => m.VerRutaPageModule)
  },
  {
    path: 'checklist-carga/:id/:tipo',
    loadChildren: () => import('./pages/checklist-carga/checklist-carga.module').then( m => m.ChecklistCargaPageModule)
  },
  {
    path: 'inicio-ruta/:id/:tipo',
    loadChildren: () => import('./pages/inicio-ruta/inicio-ruta.module').then( m => m.InicioRutaPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
