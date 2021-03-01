import { Injectable } from '@angular/core';

// Services
import { DatabaseService } from '../services/database.service';
import { CallNumber } from '@ionic-native/call-number/ngx';
import { LoadingController } from '@ionic/angular';
import { first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CallService {
  
  constructor (
    private loadingController: LoadingController,
    private callNumber: CallNumber,
    private database: DatabaseService) {}

  async llamar () {
    const loading = await this.loadingController.create({
      message: 'Procesando información...',
    });

    await loading.present ();

    let preferencias: any = await this.database.get_preferencias ().pipe (first ()).toPromise ();
    console.log (preferencias);

    this.callNumber.callNumber (preferencias.numero_emergencia, true)
      .then (async () => {
        await loading.dismiss ();
      })
      .catch (async (error: any) => {
        await loading.dismiss ();
        console.log (error);
      });
  }
}
