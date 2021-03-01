import { Component, OnInit } from '@angular/core';

// Services
import { DatabaseService } from '../../services/database.service';
import { AlertController, NavController, LoadingController, ModalController } from '@ionic/angular';
import * as moment from 'moment';
import { CallService } from '../../services/call.service';

// Param
import { ActivatedRoute } from '@angular/router';
import { CargaGasolinaPage } from '../../modals/carga-gasolina/carga-gasolina.page';

@Component({
  selector: 'app-ver-ruta',
  templateUrl: './ver-ruta.page.html',
  styleUrls: ['./ver-ruta.page.scss'],
})
export class VerRutaPage implements OnInit {
  item: any = null;
  clientes: any [] = [];
  constructor (
    private database: DatabaseService,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private navCtrl: NavController,
    private loadingController: LoadingController,
    private phone_service: CallService,
    private modalController: ModalController
  ) { }

  call () {
    this.phone_service.llamar ();
  }
  
  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Obteniendo lista de clientes...',
    });

    await loading.present ();

    this.database.get_cardex_by_id (this.route.snapshot.paramMap.get ('tipo'), this.route.snapshot.paramMap.get ('id')).subscribe (async (res: any) => {
      this.item = res;

      this.database.get_clientes_by_cardex (this.route.snapshot.paramMap.get ('tipo'), this.route.snapshot.paramMap.get ('id')).subscribe (async (res: any []) => {
        this.clientes = res;
        await loading.dismiss ();
      })
    });
  }

  async iniciar_carga () {
    if (this.item !== null || this.item !== undefined) {
      const alert = await this.alertController.create({
        header: 'Iniciar carga',
        message: 'Estás por iniciar carga. ¿Estás seguro?',
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

              this.database.update_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, 'hora_inicio_carga')
                .then (() => {
                  loading.dismiss ();
                  this.navCtrl.navigateForward (['checklist-carga', this.item.id, this.route.snapshot.paramMap.get ('tipo')]);
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

  get_hora () {
    return moment ().format ('LT');
  }

  get_fecha () {
    return moment ().format ('LL');
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
