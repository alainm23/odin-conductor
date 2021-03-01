import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

// Firebase
import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { environment } from '../environments/environment';

// Modals
import { ChecklistProductoClientePageModule } from './modals/checklist-producto-cliente/checklist-producto-cliente.module';
import { CargaGasolinaPageModule } from './modals/carga-gasolina/carga-gasolina.module'
import { AlmuerzoPageModule } from './modals/almuerzo/almuerzo.module';
import { AlertProductoPageModule } from './modals/alert-producto/alert-producto.module';

import { CallNumber } from '@ionic-native/call-number/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { OneSignal } from '@ionic-native/onesignal/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { Pedometer } from '@ionic-native/pedometer/ngx';

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,

    // Modals
    ChecklistProductoClientePageModule,
    CargaGasolinaPageModule,
    AlmuerzoPageModule,
    AlertProductoPageModule
  ],
  providers: [
    StatusBar,
    SplashScreen,
    CallNumber,
    Geolocation,
    Camera,
    Pedometer,
    OneSignal,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
