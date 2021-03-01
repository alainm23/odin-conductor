import { Component, OnInit, Input } from '@angular/core';

// Services
import { DatabaseService } from '../../services/database.service'
import { AlertController, ModalController, ActionSheetController, LoadingController, ToastController } from '@ionic/angular';
import * as moment from 'moment';
import { CallService } from '../../services/call.service';

// Utils
import { first } from 'rxjs/operators';

// Modal
import { AlertProductoPage } from '../../modals/alert-producto/alert-producto.page';

@Component({
  selector: 'app-checklist-producto-cliente',
  templateUrl: './checklist-producto-cliente.page.html',
  styleUrls: ['./checklist-producto-cliente.page.scss'],
})
export class ChecklistProductoClientePage implements OnInit {
  @Input() picking_id: string;
  @Input() tipo: string;
  @Input() cliente_id: string;

  items: any [] = [];
  cliente: any;
  cardex: any;

  constructor (
    private database: DatabaseService,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
    private phone_service: CallService,
    private toastController: ToastController
  ) { }

  call () {
    this.phone_service.llamar ();
  }

  async ngOnInit() {
    const loading = await this.loadingController.create({
      message: 'Obteniendo lista de productos...',
    });

    await loading.present ();

    this.cliente = await this.database.get_cliente_by_cardex (this.tipo, {id: this.picking_id}, this.cliente_id).pipe (first ()).toPromise ();
    this.items = await this.database.get_productos_by_cardex_cliente (this.tipo, this.picking_id, this.cliente_id).pipe (first ()).toPromise ();
    this.cardex = await this.database.get_cardex_by_id (this.tipo, this.picking_id).pipe (first ()).toPromise ();

    await loading.dismiss ();
  }

  async finalizar_descarga () {
    const alert = await this.alertController.create({
      header: 'Confirmar descarga',
      message: 'Todos los artículos se han descargado correctamente.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {

          }
        }, {
          text: 'Confirmar',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Actualizando informacion...',
            });

            await loading.present ();

            let entrega_completa: number = 0;
            let rechazado_parcial: number = 0;
            let rechazado_total: number = 0;
            let tipo_descarga: string = 'completo';
            this.items.forEach ((producto: any) => {
              if (producto.checked) {
                producto.estado = "entrega_completa";
                entrega_completa++;
              }

              if (producto.estado === 'rechazado_parcial') {
                this.cardex.numero_total_rechazos_parciales += 1;
                rechazado_parcial++;
              }

              if (producto.estado === 'rechazado_total') {
                this.cardex.numero_total_rechazos_totales += 1;
                rechazado_total++;
              }
            });

            if (entrega_completa >= this.items.length) {
              tipo_descarga = 'completo';
            } else if (rechazado_total >= this.items.length) {
              tipo_descarga = 'rechazado';
            } else {
              tipo_descarga = 'parcial';
            }

            this.database.update_cliente_cardex_ruta (this.tipo, this.cardex, this.cardex.cliente_actual, 'hora_fin_descarga', tipo_descarga)
              .then (() => {
                this.database.update_cardex_cliente_productos (this.tipo, this.cardex.id, this.cliente_id, this.items)
                  .then (async () => {
                    /*  Despues de actualizar la lista de produtos del cliente, necesitamos
                    *  saber que cual es el siguiente cliente ya
                    *  empezar a escanear la nueva ruta cuando el modal salga
                    */

                    let clientes = await this.database.get_clientes_by_cardex (this.tipo, this.picking_id).pipe (first ()).toPromise ();
                    console.log ('clientes', clientes);

                    let cliente_siguiente = clientes [this.cardex.cliente_actual.orden + 1];
                    console.log ('cliente_siguiente', cliente_siguiente);

                    if (cliente_siguiente !== null && cliente_siguiente !== undefined) {
                      this.cardex.cliente_actual.id = cliente_siguiente.id;
                      this.cardex.cliente_actual.nombre = cliente_siguiente.cliente_nombre;
                      this.cardex.cliente_actual.orden = cliente_siguiente.orden;

                      console.log (this.cardex);

                      this.database.update_cardex (this.tipo, this.cardex)
                        .then (async () => {
                          await loading.dismiss ();
                          this.modalCtrl.dismiss (null, 'ok');
                        }).catch (async (error: any) => {
                          console.log (error);
                          await loading.dismiss ();
                        });
                    } else {
                      if (this.cardex.numero_total_rechazos_totales > 0 || this.cardex.numero_total_rechazos_parciales > 0) {
                        this.cardex.estado = 'camino_almacen';
                      } else {
                        this.cardex.estado = 'fin_ruta';
                      }

                      this.database.update_cardex (this.tipo, this.cardex)
                        .then (async () => {
                          await loading.dismiss ();
                          this.modalCtrl.dismiss (null, 'ok');
                        }).catch (async (error: any) => {
                          console.log (error);
                          await loading.dismiss ();
                        });
                    }
                  }).catch ((error: any) => {
                    console.log (error);
                  });
              })
              .catch ((error: any) => {
                console.log (error);
              });
          }
        }
      ]
    });

    await alert.present ();
  }

  close_modal () {
    this.modalCtrl.dismiss (null);
  }

  async alert_devolucion (producto: any, typo: string) {
    let modal = await this.modalCtrl.create({
      component: AlertProductoPage,
      cssClass: 'modal-alert ',
      componentProps: {
        tipo: typo,
        producto: producto
      }
    });

    modal.onDidDismiss ().then (async (response: any) => {
      if (response.role === 'ok') {
        console.log (response);

        producto.estado = response.data.tipo;
        producto.rechazo_motivo = response.data.motivo
        producto.rechazo_cantidad = response.data.cantidad;
      } else if (response.role === 'clear') {
        producto.estado = '';
        producto.rechazo_motivo = '';
        producto.rechazo_cantidad = 0;
      }
    });

    await modal.present();
  }

  async eliminar (producto: any) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Albums',
      subHeader: '',
      mode: 'md',
      buttons: [{
        text: 'Devolucion partical',
        role: 'destructive',
        icon: 'arrow-back-circle-outline',
        handler: () => {
          this.alert_devolucion (producto, 'rechazado_parcial');
        }
      }, {
        text: 'Devolucion total',
        role: 'destructive',
        icon: 'close-circle-outline',
        handler: () => {
          this.alert_devolucion (producto, 'rechazado_total');
        }
      }, {
        text: 'Cancelar',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
      }]
    });

    await actionSheet.present();
  }

  get_hora () {
    return moment ().format ('LT');
  }

  get_fecha () {
    return moment ().format ('LL');
  }

  async rechazo_total () {
    // this.modalCtrl.dismiss (null, 'rechazo_total');
    const actionSheet = await this.actionSheetController.create({
      header: 'Operaciones',
      subHeader: '',
      mode: 'md',
      buttons: [{
        text: 'Notificar ausencia',
        role: 'destructive',
        icon: 'warning-outline',
        handler: () => {
          this.send_alert_notification ('hora_ausencia');
        }
      }, {
        text: 'Notificar rechazo total',
        role: 'destructive',
        icon: 'hand-left-outline',
        handler: () => {
          this.send_alert_notification ('hora_rechazo_total');
        }
      }, {
        text: 'Cancelar',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          
        }
      }]
    });

    await actionSheet.present();
  }

  async send_alert_notification (action: string) {
    let header = 'Notificar ausencia';
    if (action === 'hora_ausencia') {
      header = 'Notificar ausencia';
    } else if (action === 'hora_rechazo_total') {
      header = 'Notificar rechazo total';
    }
    const alert = await this.alertController.create({
      header: header,
      message: '¿Esta seguro que desea continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {

          }
        }, {
          text: 'Confirmar',
          handler: async () => {
            this.modalCtrl.dismiss (null, action);
          }
        }
      ]
    });

    await alert.present ();
  }
}
