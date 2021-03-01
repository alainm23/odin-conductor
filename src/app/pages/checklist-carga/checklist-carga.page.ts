import { Component, OnInit } from '@angular/core';

// Services
import { DatabaseService } from '../../services/database.service';
import { AlertController, NavController, LoadingController, ModalController } from '@ionic/angular';
import { CallService } from '../../services/call.service';

// Param
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import * as moment from 'moment';
import { CargaGasolinaPage } from '../../modals/carga-gasolina/carga-gasolina.page';
@Component({
  selector: 'app-checklist-carga',
  templateUrl: './checklist-carga.page.html',
  styleUrls: ['./checklist-carga.page.scss'],
})
export class ChecklistCargaPage implements OnInit {
  item: any = null;
  productos: any = null;

  hora_inicio_carga: string = '';
  constructor (
    private database: DatabaseService,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private navCtrl: NavController,
    private phone_service: CallService,
    private loadingController: LoadingController,
    private modalController: ModalController
  ) { }

  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Obteniendo lista de productos...',
    });

    this.database.get_cardex_by_id (this.route.snapshot.paramMap.get ('tipo'), this.route.snapshot.paramMap.get ('id')).subscribe (async (res: any) => {
      this.item = res;
      this.hora_inicio_carga = this.timestamp_to_date (res.hora_inicio_carga);
      if (this.productos === null) {
        this.productos = await this.database.get_productos_by_cardex (this.route.snapshot.paramMap.get ('tipo'), this.route.snapshot.paramMap.get ('id')).pipe (first ()).toPromise ();
      }
      
      await loading.dismiss ();
    });
  }

  timestamp_to_date (timestamp: any) {
    try {
      let hora = timestamp.toDate ().getHours ();
      let minutos = timestamp.toDate ().getMinutes ();
      if (minutos.toString ().length <= 1) {
        minutos = '0' + minutos.toString ();
      } else {
        minutos = minutos.toString ();
      }

      return hora + ':' + minutos;
    } catch (error) {
      return "";
    }
  }

  get_hora () {
    return moment ().format ('LT');
  }

  get_fecha () {
    return moment ().format ('LL');
  }

  async finalizar_descarga () {
    if (this.item !== null || this.item !== undefined) {
      const alert = await this.alertController.create({
        header: 'Confirmar carga',
        message: 'Todos los artículos se han cargado correctamente.',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'secondary',
            handler: (blah) => {
              console.log('Confirm Cancel: blah');
            }
          }, {
            text: 'Confirmar',
            handler: async () => {
              const loading = await this.loadingController.create({
                message: 'Procesando información...',
              });

              await loading.present ();

              this.database.update_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, 'hora_fin_carga')
                .then (() => {
                  loading.dismiss ();
                  this.navCtrl.navigateForward (['inicio-ruta', this.item.id, this.route.snapshot.paramMap.get ('tipo')]);
                })
                .catch ((error: any) => {
                  loading.dismiss ();
                  console.log (error);
                });
            }
          }
        ]
      });

      await alert.present ();
    }
  }

  check_disbled_button () {
    let cantidad: number = 0;

    if (this.productos !== null) {
      this.productos.forEach ((producto: any) => {
        if (producto.checked === true) {
          cantidad++;
        }
      });

      if (cantidad >= this.productos.length) {
        return false;
      } else {
        return true;
      }
    }

    return false;
  }

  call () {
    this.phone_service.llamar ();
  }

  async recargar () {
    let modal = await this.modalController.create({
      component: CargaGasolinaPage,
      componentProps: {
        carro_id: this.item.vehiculo_id,
        tipo: this.route.snapshot.paramMap.get ('tipo'),
        cardex: this.item
      }
    });

    modal.onDidDismiss ().then (async (response: any) => {
      if (response.role === 'evento') {
        const loading = await this.loadingController.create ({
          message: 'Registrando evento...',
        });

        await loading.present ();

        let evento: any = {
          id: this.database.createId (),
          nombre: 'Recarga de combustible',
          tipo: 'recarga_combustible',
          conductor_id: this.item.conductor_id,
          vehiculo_id: this.item.vehiculo_id,
          hora_inicio: moment().format('HH[:]mm'),
          hora_fin: null
        };

        this.database.add_cardex_event (this.route.snapshot.paramMap.get ('tipo'), this.item, evento)
          .then (() => {
            loading.dismiss ();
          }).catch ((error: any) => {
            console.log (error);
            loading.dismiss ();
          });
      }
    });

    await modal.present ();
  }
}
