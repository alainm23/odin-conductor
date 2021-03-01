import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';

// Services
import { DatabaseService } from '../../services/database.service';
import { AlertController, NavController, ActionSheetController, ModalController, LoadingController, ToastController } from '@ionic/angular';
declare var google: any;
import { Geolocation } from '@ionic-native/geolocation/ngx';

// Param
import { ActivatedRoute } from '@angular/router';

// Modals
import { ChecklistProductoClientePage } from '../../modals/checklist-producto-cliente/checklist-producto-cliente.page';
import { AlmuerzoPage } from '../../modals/almuerzo/almuerzo.page';
import { CargaGasolinaPage } from '../../modals/carga-gasolina/carga-gasolina.page';
import { CallService } from '../../services/call.service';
import { AngularFireStorage } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';

// Utils
import { first } from 'rxjs/operators';
import { filter } from 'rxjs/operators';
import * as moment from 'moment';
import { Observable } from 'rxjs';

// Camera
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';
import { Pedometer, IPedometerData } from '@ionic-native/pedometer/ngx';

@Component({
  selector: 'app-cardex',
  templateUrl: './cardex.page.html',
  styleUrls: ['./cardex.page.scss'],
})
export class CardexPage implements OnInit {
  @ViewChild('map', { static: false }) mapRef: ElementRef;
  map: any = null;
  directionsService: any;
  directionsDisplay: any;
  marker_inicio: any;
  marker_destino: any;
  marker_vehiculo: any = null;
  watch: any =  null;
  draw_position: any;

  checklist_modal: any = null;
  almuerzo_disponible: any = null;
  item: any;
  clientes: any [] = [];
  cliente_actual: any;

  botton_accion: any = {
    text: '',
    accion: ''
  };

  confirmacion_subscribe: any = null;
  confirmacion: any = null;
  isTracking: boolean = false;
  positionSubscription: any;
  trackedRoute: any [] = [];
  current_latitude: number = 0;
  current_longitude: number = 0;
  constructor (
    private database: DatabaseService,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private navController: NavController,
    private actionSheetController: ActionSheetController,
    private modalController: ModalController,
    private loadingController: LoadingController,
    private geolocation: Geolocation,
    private phone_service: CallService,
    private toastController: ToastController,
    private af_storage: AngularFireStorage,
    private camera: Camera,
    private pedometer: Pedometer
  ) { }

  call () {
    this.phone_service.llamar ();
  }

  async ngOnInit () {
    this.check_ruta ();
  }
  
  async check_ruta () {
    if (this.confirmacion_subscribe !== null) {
      this.confirmacion_subscribe.unsubscribe ();
    }

    const loading = await this.loadingController.create({
      message: 'Verificando ruta...',
    });

    await loading.present ();
    this.item = await this.database.get_cardex_by_id (this.route.snapshot.paramMap.get ('tipo'), this.route.snapshot.paramMap.get ('id')).pipe (first ()).toPromise ();
    this.almuerzo_disponible = await this.database.almuerzo_disponible (this.item.conductor_id, moment ().format ('DD[-]MM[-]YYYY')).pipe (first ()).toPromise ();
    await loading.dismiss ();

    if (this.item.cliente_actual === null || this.item.cliente_actual === undefined) {
      if (this.item.estado === 'camino_almacen') {
        this.botton_accion.text = 'LLegada al almacen'
        this.botton_accion.accion = 'hora_llegada_almacen';
      } else if (this.item.estado === 'fin_ruta') {
        this.botton_accion.text = 'Fin de ruta'
        this.botton_accion.accion = 'hora_fin_ruta';
      } else if (this.item.estado === 'finalizado') {
        this.botton_accion.text = 'Regresar al inicio'
        this.botton_accion.accion = 'final_final';
      }
    } else if (this.item.estado === 'fin_ruta') {
      this.botton_accion.text = 'LLegada al almacen'
      this.botton_accion.accion = 'hora_llegada_almacen';
    } else {
      if (this.item.estado === 'almuerzo' || this.item.estado === 'fallo_mecanico' || this.item.estado === 'accidente') {
        this.open_evento_modal (this.item.evento_actual);
      } else {
        const loading = await this.loadingController.create({
          message: 'Obteniendo infomacion del cliente actual...',
        });

        await loading.present ();

        this.cliente_actual = await this.database.get_cliente_by_cardex (this.route.snapshot.paramMap.get ('tipo'), this.item, this.item.cliente_actual.id).pipe (first ()).toPromise ();

        await loading.dismiss ();

        if (this.cliente_actual.estado === 'asignado') {
          this.botton_accion.text = 'Confirmar llegada'
          this.botton_accion.accion = 'hora_llegada';
        } else if (this.cliente_actual.estado === 'llego') {
          this.botton_accion.text = 'Opciones >'
          this.botton_accion.accion = 'hora_inicio_descarga';
        } else if (this.cliente_actual.estado === 'descargando') {
          this.open_checklist_modal ();
        } else if (this.cliente_actual.estado === 'ausente' || this.cliente_actual.estado === 'pendiente_rechazo_total') {
          this.botton_accion.text = 'Esperando confirmacion...'
          this.botton_accion.accion = 'esperando_confirmacion';

          this.confirmacion_subscribe = this.database.get_confirmacion_pendiente_ausente_usuario (
            this.route.snapshot.paramMap.get ('tipo'),
            this.item.id,
            this.item.cliente_actual.id
          ).subscribe ((res: any) => {
            if (this.confirmacion === null) {
              this.confirmacion = res;
            } else {
              if (this.confirmacion.estado !== res.estado) {
                this.confirmacion_subscribe.unsubscribe ();
                this.confirmacion = null;
                this.confirmacion_subscribe = null;
                
                this.check_ruta ();
              }
            }
          });
        }
      }
    }

    // Creando mapa
    this.init_map (this.item);
  }

  async init_map (item: any) {
    // Agregar aqui las cordenadas exactas del almacen 
    // let point = new google.maps.LatLng (resp.coords.latitude, resp.coords.longitude)

    const options = {
      zoom: 15,
      disableDefaultUI: true,
      streetViewControl: false,
      disableDoubleClickZoom: false,
      clickableIcons: false,
      scaleControl: true,
      mapTypeId: 'roadmap'
    }

    this.map = new google.maps.Map (this.mapRef.nativeElement, options);

    this.directionsDisplay = new google.maps.DirectionsRenderer ();
    this.directionsService = new google.maps.DirectionsService ();

    let point_inicio: any;
    let point_destino: any;

    if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
      if (item.cliente_actual.orden <= 0) {
        point_inicio = new google.maps.LatLng (-13.585056, -71.804972);
        point_destino = new google.maps.LatLng (item.clientes [item.cliente_actual.orden].latitud, item.clientes [item.cliente_actual.orden].longitud);

        this.marker_inicio = new google.maps.Marker ({
          position: point_inicio,
          icon: 'assets/img/icono almacen.png',
          map: this.map
        });

        this.marker_destino = new google.maps.Marker ({
          position: point_destino,
          label: { 
            text: (item.cliente_actual.orden + 1).toString (),
            color: "white",
            fontWeight: 'bold',
            fontSize: '16px'
          },
          map: this.map
        });

        this.marker_destino.addListener ('click', async (data: any) => {
          const alert = await this.alertController.create({
            header: item.clientes [item.cliente_actual.orden].cliente_nombre,
            subHeader: item.clientes [item.cliente_actual.orden].cliente_direccion,
            buttons: ['OK']
          });
      
          await alert.present();
        });
      } else {
        point_inicio = new google.maps.LatLng (item.clientes [item.cliente_actual.orden - 1].latitud, item.clientes [item.cliente_actual.orden - 1].longitud);
        point_destino = new google.maps.LatLng (item.clientes [item.cliente_actual.orden].latitud, item.clientes [item.cliente_actual.orden].longitud);

        this.marker_inicio = new google.maps.Marker ({
          position: point_inicio,
          label: { 
            text: (item.cliente_actual.orden).toString (),
            color: "white",
            fontWeight: 'bold',
            fontSize: '16px'
          },
          map: this.map
        });

        this.marker_inicio.addListener ('click', async (data: any) => {
          const alert = await this.alertController.create({
            header: item.clientes [item.cliente_actual.orden - 1].cliente_nombre,
            subHeader: item.clientes [item.cliente_actual.orden - 1].cliente_direccion,
            buttons: ['OK']
          });
      
          await alert.present();
        });

        this.marker_destino = new google.maps.Marker ({
          position: point_destino,
          label: { 
            text: (item.cliente_actual.orden + 1).toString (),
            color: "white",
            fontWeight: 'bold',
            fontSize: '16px'
          },
          map: this.map
        });

        this.marker_destino.addListener ('click', async (data: any) => {
          const alert = await this.alertController.create({
            header: item.clientes [item.cliente_actual.orden].cliente_nombre,
            subHeader: item.clientes [item.cliente_actual.orden].cliente_direccion,
            buttons: ['OK']
          });
      
          await alert.present ();
        });
      }
    } else{
      point_inicio = new google.maps.LatLng (item.clientes [item.clientes.length - 1].latitud, item.clientes [item.clientes.length - 1].longitud);
      point_destino = new google.maps.LatLng (-13.585056, -71.804972);

      this.marker_inicio = new google.maps.Marker ({
        position: point_inicio,
        label: { 
          text: (item.clientes.length).toString (),
          color: "white",
          fontWeight: 'bold',
          fontSize: '16px'
        },
        map: this.map
      });

      this.marker_inicio.addListener ('click', async (data: any) => {
        const alert = await this.alertController.create({
          header: item.clientes [item.clientes.length - 1].cliente_nombre,
          subHeader: item.clientes [item.clientes.length - 1].cliente_direccion,
          buttons: ['OK']
        });
    
        await alert.present();
      });

      this.marker_destino = new google.maps.Marker ({
        position: point_destino,
          icon: 'assets/img/icono almacen.png',
          map: this.map
      });
    }

    this.directionsDisplay.setMap (this.map);
    this.directionsDisplay.setOptions( { suppressMarkers: true } );
    
    let request = {
      origin: point_inicio,
      destination: point_destino,
      travelMode: google.maps.TravelMode ['DRIVING']
    }

    this.directionsService.route (request, (response: any, status: any) => {
      if (status == 'OK') {
        this.directionsDisplay.setDirections (response);
      }
    });

    if (this.watch === null) {
      this.watch = this.geolocation.watchPosition ()
      .pipe(
        filter((p: any) => p.coords !== undefined) //Filter Out Errors
      )
      .subscribe ((data: any) => {
        setTimeout(() => {
          this.current_latitude = data.coords.latitude;
          this.current_longitude = data.coords.longitude;

          if (this.marker_vehiculo === null) {
            this.marker_vehiculo = new google.maps.Marker ({
              position: new google.maps.LatLng (data.coords.latitude, data.coords.longitude),
              icon: 'assets/img/Icono carro.png',
              map: this.map
            });
          } else {
            this.marker_vehiculo.setPosition (
              new google.maps.LatLng (data.coords.latitude, data.coords.longitude)
            );
          }

          this.database.update_vehiculo_position (this.route.snapshot.paramMap.get ('tipo'), item.id, item.vehiculo_id, data.coords.latitude, data.coords.longitude);
        }, 0);
      }); 
    }

    // this.pedometer.isDistanceAvailable ()
    // .then((available: boolean) => {
    //   console.log('isDistanceAvailable', available);
    // })
    // .catch((error: any) => console.log(error));

    // this.pedometer.startPedometerUpdates ().subscribe ((data: IPedometerData) => {
    //   console.log ('IPedometerData', data);
    // });
  }

  async open_checklist_modal () {
    this.checklist_modal = await this.modalController.create({
      component: ChecklistProductoClientePage,
      componentProps: {
        picking_id: this.item.id,
        cliente_id: this.cliente_actual.id,
        tipo: this.route.snapshot.paramMap.get ('tipo')
      }
    });

    this.checklist_modal.onDidDismiss ().then (async (response: any) => {
      if (response.role === 'ok') {
        this.check_ruta ();
      } else if (response.role === 'hora_ausencia' || response.role === 'hora_rechazo_total'){
        const loading = await this.loadingController.create({
          message: 'Actualizando informacion ...',
        });
    
        await loading.present ();

        this.database.update_cliente_cardex_ruta (
          this.route.snapshot.paramMap.get ('tipo'),
          this.item,
          this.cliente_actual,
          response.role)
          .then (async () => {
            this.presentToast ('La notificacion fue enviada');
            await loading.dismiss ();
            this.check_ruta ();
          })
          .catch (async (error: any) => {
            await loading.dismiss ();
            console.log (error);
          });
      }
    });

    await this.checklist_modal.present ();
  }

  async accion () { 
    if (this.botton_accion.accion === 'hora_inicio_descarga') {
      const actionSheet = await this.actionSheetController.create({
        header: 'Operaciones',
        subHeader: '',
        mode: 'md',
        buttons: [{
          text: 'Iniciar descarga',
          role: 'destructive',
          icon: 'download-outline',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Actualizando informacion ...',
            });

            await loading.present ();

            this.database.update_cliente_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, this.cliente_actual, this.botton_accion.accion)
              .then (async () => {
                await loading.dismiss ();
                this.open_checklist_modal ();
              })
              .catch (async (error: any) => {
                await loading.dismiss ();
                console.log (error);
              });
          }
        }, {
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
    } else if (this.botton_accion.accion === 'final_final') {
      this.navController.navigateRoot ('home');
    } else if (this.botton_accion.accion === 'fin_ruta') {
      const alert = await this.alertController.create({
        header: 'Marcar llegada al almacen',
        message: '¿Estas seguro?',
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
                message: 'Actualizando informacion ...',
              });

              await loading.present ();
              
              this.database.update_cliente_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, this.cliente_actual, this.botton_accion.accion)
                .then (async () => {
                  await loading.dismiss ();
                  this.check_ruta ();
                })
                .catch ((error: any) => {
                  console.log (error);
                });
            }
          }
        ]
      });

      await alert.present ();
    } else if (this.botton_accion.accion === 'hora_fin_ruta') {
      const alert = await this.alertController.create({
        header: 'Marcar llegada',
        message: '¿Haz finalizado la ruta?',
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
                message: 'Actualizando informacion ...',
              });

              await loading.present ();

              console.log (this.item);
              console.log (this.cliente_actual);

              this.database.update_cliente_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, this.cliente_actual, this.botton_accion.accion)
                .then (async () => {
                  await loading.dismiss ();
                  this.check_ruta ();

                  this.database.finalizar_ruta_vehiculo (this.item);
                })
                .catch ((error: any) => {
                  console.log (error);
                });
            }
          }
        ]
      });

      await alert.present ();
    } else if (this.botton_accion.accion === 'hora_llegada_almacen') {
      const alert = await this.alertController.create({
        header: 'Marcar llegada',
        message: '¿Haz llegado al almacen?',
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
                message: 'Actualizando informacion ...',
              });

              await loading.present ();

              console.log (this.item);
              console.log (this.cliente_actual);

              this.database.update_cliente_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, this.cliente_actual, this.botton_accion.accion)
                .then (async () => {
                  await loading.dismiss ();
                  this.check_ruta ();
                })
                .catch ((error: any) => {
                  console.log (error);
                });
            }
          }
        ]
      });

      await alert.present ();
    } else if (this.botton_accion.accion === 'esperando_confirmacion') {
      const alert = await this.alertController.create({
        message: 'Esperando confirmacion del administrador',
        buttons: [
          {
            text: 'Ok',
            role: 'cancel',
            handler: (blah) => {
              
            }
          }
        ]
      });

      await alert.present ();
    } else {
      if (this.is_punto_valido ()) {
        const alert = await this.alertController.create({
          header: 'Marcar llegada',
          message: `Haz llegado a <strong>${ this.item.cliente_actual.nombre }</strong>.`,
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
                  message: 'Actualizando informacion ...',
                });
  
                await loading.present ();
  
                console.log (this.item);
                console.log (this.cliente_actual);
  
                this.database.update_cliente_cardex_ruta (this.route.snapshot.paramMap.get ('tipo'), this.item, this.cliente_actual, this.botton_accion.accion)
                  .then (async () => {
                    await loading.dismiss ();
                    this.check_ruta ();
                  })
                  .catch ((error: any) => {
                    console.log (error);
                  });
              }
            }
          ]
        });
        await alert.present ();
      } else {
        const alert = await this.alertController.create({
          header: 'No es una distancia valida',
          subHeader: 'Subtitle',
          message: 'This is an alert message.',
          buttons: ['OK']
        });
    
        await alert.present ();    
      }
    }
  }

  is_punto_valido () {
    let d = this.database.get_distancia (
      this.cliente_actual.latitud, this.cliente_actual.longitud,
      this.current_latitude, this.current_longitude, 
      // -13.524918, -71.9510481,
      1000
    );
    
    if (d <= 200) {
      return true;
    }

    return true;
    // return false;
  }

  async send_alert_notification (action: string) {
    let header = 'Notificar ausencia';
    if (action === 'hora_ausencia') {
      header = 'Notificar ausencia';
    } else if (action === 'hora_rechazo_total') {
      header = 'Notificar rechazo total';
    }

    if (action === 'hora_ausencia') {
      this.selectImageSource ();
    } else {
      const alert = await this.alertController.create({
        header: header,
        message: '¿Esta seguro que desea continuar?',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'secondary',
            handler: (blah) => {
              this.check_ruta ();
            }
          }, {
            text: 'Confirmar',
            handler: async () => {
              const loading = await this.loadingController.create({
                message: 'Actualizando informacion ...',
              });
          
              await loading.present ();
  
              this.database.update_cliente_cardex_ruta (
                this.route.snapshot.paramMap.get ('tipo'),
                this.item,
                this.cliente_actual,
                action
              )
                .then (async () => {
                  this.presentToast ('La notificacion fue enviada');
                  await loading.dismiss ();
                  this.check_ruta ();
                })
                .catch (async (error: any) => {
                  await loading.dismiss ();
                  console.log (error);
                });
            }
          }
        ]
      });
  
      await alert.present ();
    }
  }

  async selectImageSource () {
    const actionSheet = await this.actionSheetController.create({
      buttons: [{
        text: 'Tomar una foto',
        icon: 'camera',
        handler: () => {
          this.takePicture (this.camera.PictureSourceType.CAMERA);
        }
      }, {
        text: 'Seleccionar una foto',
        icon: 'images',
        handler: () => {
          this.takePicture (this.camera.PictureSourceType.PHOTOLIBRARY);
        }
      }]
    });

    await actionSheet.present();
  }

  async takePicture (sourceType: PictureSourceType) {
    const options: CameraOptions = {
      quality: 95,
      sourceType: sourceType,
      saveToPhotoAlbum: false,
      correctOrientation: true,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE
    }

    const loading = await this.loadingController.create({
      message: 'Procesando Informacion ...'
    });

    await loading.present ();

    this.camera.getPicture(options).then (async (imageData) => {
      loading.dismiss ();

      let imagen = 'data:image/jpeg;base64,' + imageData;
      // let imagen = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/7QAsUGhvdG9zaG9wIDMuMAA4QklNA+0AAAAAABAAls+SAAEAAgCWz5YAAQAC/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgBXQJsAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8AxqKKKBhRRRQAnelFJ3pRQAd6cKb3pwoAUUUCigAFLSCloAKKKKACgUUCgBe1FHaigApaSloAKKKKACiiigAooooAKWkpaACiiigTCiiigEFHHeikJA60DG45p+7aKgmu44RzWfLrcY4Xk0gNJ3I525qvJduFKiL8c1iXOvyAEJgVlvrN078yAL9KBnTTasIV/wBXk/WoR4gQoQ8RHvmualvXYZEgJpiXshQhlDH0A60xm++vRbuCKswa7GcArkVzAaKX/WKUPvS+SwOYnBFAHaJqdu54kCfWrKTI44kDfSuC811b5kY/StK1uCRwxT6mkM6/ICAE80uxgwPasaG5kWMeYfmqxHeyLIN/3aANGUE00MQKbHcrJTywJpEgDmiiiqRLCiiigYUUUUAFFFFABRRRQAGkpTSUAFFFFABSGlpDQAlFFFACUlLSUAIaSlNJQAUUUUAFIaWkNABSGlpDQAUUUUAPooooAKKKKAFooooATvThTe9OFACiigUUAApaQUtABRRRQAUCigUAOooooAKKKKAClpKWgAooooAKKKKACiiigAooooAQ0Y4zQajkuEgHzmgaQ8sgUlmxWPqGqrDhYznNZ2r6wCSsTViCaVznIOf71Ay7LfSSOSZAB7mq73Zj5Vo2J4NV5QT12/hTEtgMt1z6UgJHuVzlgCaUnzI8hBj2FQiH5sMMe5qdbaYfNDIGx/DmgCMxwyf6jcH75prF0YDIDVYKmfmNNjL1wKesMN4vl7is3Y0wKykn/aanC8MLASLjntTHtrm3k2KC3vTzBIxUSJknv6UAXRPE21yjVoKLS7QAKyH1FY8kBi2qZCR9atqrqF8vdzSGX1gkwYpHJA6MDU0F2EzFOCCPuk96VV84fZ923A4c8VTmfEnlTruK/dZeaANGO4VGyrZqwLzcOTiudlZoeQTT7e8LnD8UgOlgvBLKseenFXuVkHGRXKLceTcKynrXS2t6k6gd6pEtFhsZ4pKMY60UCEopaXFADaKU0lABRRRQAGkpTSUAFFFFABSUtJQAU2nU2gBDRSGloAQ0lKaSgAooooAKQ0tIaAClpKUUAIaSlNJQA8UtNFOoAKKKKACiiigAooooAcOlLSL0paACiiigApaQUtABRRRQAUtJS0AFFFFABS0lLQAUUUUAFFFFABRRRQAUuOM0lRSzCEEt0pMaFkkEaEmua1O8MmfnOR0FX7q6JRiTwelc3MrPMST16UiioFkkc7oxj1qVIUU5dsj09KbNLNHxniod0uQVGc9aANEW9vOuI/ve4qB7Se35dgiHgEGkjkuFHC4H1p9w8UkGJHYt6Y6UxDFzgLN8wPf2pJLZ4ZVlt3IQc7v6VYskEsOGGRnaPpV1rfbC1u3EA/i96AKaXUc0JLDyi3dRQ1rhxMBsCclh1NSafb75Ht5VGG+4alj8xG2zE7icAUXEL+/hQSxqJlP984q2jRXEBZ12PjhVGaYwaMDcu9TUUk4t9rQnBJ6UXAWC3Sd/Lkjwexq7Fp8yuREQwHWqMmonADKAT1Hr71dgvhBD5iyZb/0GgoiuxiLbzle1VFL3+PKOxl7VauNQWZBIVAJ6iqrCOKZJ4mwO4FAFCd7u1ci4i3LnrTEkWU7l49q7GBYdStT52DgcVzl9YC3kYxjC0AQQ3CyMY3XBB+UitbT5duoJvbanoKxoGXJKjOByahF60e4Qndk9fSqRJ6IVIUMHzSg7xxxiua0jU2MoidyV9TXTZVVyOhpCAkHpSUgFLQAUUUUAFFFFACGilNJQAUlLSUAJQaKDQAlJS0lADTRQaKACiiigApKWkoAKKKKAENAoNAoAKKKKAHUUUUALRRRQAd6Wm96dQAYoxS0UAHSiiigApaSgUAOooooAKKKKAClpKWgAooooAKWkpaACiiigAooooAKXjb70lH+TQBGz+WpZjwKwtQ1H7RN5ScIKsate/MI0PHeskxbLgODlMUmNE84JgAZsj0qjJHuwTxgcUt/exjCoeaiLySopPpSKIZIkY/PzS+VHswvFIY2J5NPS1MnSQLj170DEt4Zc/K36UTpeIDyGU8Eba1LIi2Iyyt+FaUl9DNEUaJR74pXA5zSbz/SGhkGFxirc77GMIOB1FV7q3Ec4ljGOaZehn2SqeR1oCwCYvcK2cFa1op4pJl3Dk9ayVhM4BXgipyjRqHwQV/Wi47GrfOscKshHlk4IrEuQQvmwn5CcEVqIRK/lsCVkUD6Go5bYRIwAyg+X8aAsc+ZDuI5x0qSCeRX2ueBV/wCw8hivHWmTWuUBC8nrRcLFYOolIOeelPgmLFgvQ8CpI7Yv82OR0pzWUkUoCKcdaLhYXT7ya3uNu7CbuRWzeuJ02sMoy5rKltXVWIX5tuasicm3TI5VcGgRj3sTQBPLP7s9RVZ4Wb7vyqvX3q5dTBlbjpxUFvFLJEQ54HX3qkyWiXT5nRixbIXpXZadfLeQKg++K4uKD7MGAOR1q/p+om1u02jgmmSdscDhe3WgUxGDoHB+8M08UAFFBooAKKKKACiiigAptOptACUhNLSUAJmig0UANNFBooAKKKKACkpaSgApaSloAQikpaSgAooooAdRRRQAtFFFACd6dTe9OoAM0tJSigBaMUUUAGKKKKADNLSUooAKKO1FABS0lLQAUuKSloAMUUUUAFJmlpKAFpSMCgUvUUANXk80yZhCrsT8tOY7azb2cyyeQOnekxmTPE7uWbqTxVW5kS3teCSc96sXt3slYD+EcVmykSSCJun3qSGinKrOokI5NaEK7YF5ySMmq0x8yQRp90UoMiPs60NlpXJSjNzV61sRKm4sQaS0tnkXODXSaZppZRvU1m2aKBkJp5XvUj2bBQcAj2rsF0ZJAMKfyrRi8PI0WNvJ9qm5XIeeCyecbVXIpjaSV+8GxXqMPhpIISQvNMi8O+bktH+lF2PkR5tbaU5O5VNXJNIeWWMlefQd69A/sAxJ8sf6VKnh6R9rBTkegp3YrI4S30Z4g0hALdh6VImmboGVkIyc8jvXpLeHJ0hBaFcHv3oj0DC48on/AHh0ouybI8ubS3EewxnH0qpJprDICHH0r1Wbw4W6BvyqofDDZ5DflRdhZHm0Ong4wp4rTttJaRlJUcV3q+FolPC/pUw8P+UOBU3ZVked3WloHIVDkjBrPbQ5AjBVOCc16k+jx7uV5qrLpY5CrTUh8qPGNT05442BAGPSspJmgi2Zzj1r0zxDoZwW9a89u7DypmU54rRMwmhLctPEx456VIIHOwqBweTSaKqvdBD90GtVoRCXT8aq5NtDY0yRntgM5xxV88JnvWDoVyFZ4ied1b/XNUiWIOQCaXFHYCigQlFBooAKTNLSUAGaaTS0hoATNFFFACGig0UANNFBooAKKKKACkpaSgAooooAKMUUooATFJS0lADqKKKADNGaKKADvTqbTqADFLRRQAtFAooAKKKKAClpBS0AFFFFABS0lLQAUtJS0AFFFFABRiiigAp3Sm0pPIoAbKMqT6VhNMRduNv3+/pW5If3bVguhMxf0NJjRmX8ZS+iiHzAn5jUNwm23aTA3dBWvLCHkaUjoOKxdXnXAiU1LKSuV7KNnVm/iNa+n6e0zgNksTxUGiWTSOp7V3Omaf5cyhVySwqGzWMbFyw8HX8dgLowjyj0JNbdlok/lDCKD3ya6C81G4Gk2unIuMryagijYqN7c1nJm8RbPS2jx5hX860/ssAUbpCPoKrwxe2fxq9FCpPzrgVKZTJIbaE4xIW9sVbSONOkYNJFGgHyip1yTgjirRDZGyRsu3ygPeliiCOu3jHep9opwUZpmbY+V2lUDOMd6hMRYglycVLRQSNCgds0xgp/hFSGmGhlIiZIxzsFRSupGNgFSueKrOeallEMq23diD9KpPBbAlvNbn2qeZWzVeRW29KlMtGdLocOr3yW3nFVI+9ivOfGvhhdE1GWONvOUdzXp0YYXsbRNtcDmuV8X27XLTTySbmbpWiZnOJ5hY2YhlPGN3f0rWv41SZwq5AiBzSCMGeJO5NSXQJkP+0NtaoxZjaWmNTyGIBGcV1ittB4zXKQDyNQrqF5jU+tUjNknYH1oo7CimIKTFLRQAlJTjTaAEpDS0hoASiiigBDRQaKAGmig0UAFFFFABSUtJQAUUUUAFFFFABRiiigAzS00U6gAxRilooATvTqb3p1AC0UUUAFGaKKAFHNGKBS0AFFFFABRRRQAUtJS0AFLSUtABRRRQAUUUUAFBFFLQBGwyjCsiT90ShGTJ0PpWwejVizzKLgA9VpMaILu5WG32YyU5J9a5gq11f8g4Na15ma6nQHhQDUljZBblcjsDUMuO502g6ekUCgjJNd1pNkqyDjopOa57Q4CSuRxXZ2yiKykf8AizgVmzdE05Msds3RgDzTlwTkDBokG21tvoaB14rKRrFItxAVciAzxVGLNXIjg0kNl+I7RVgZK5qqp4FWUbC1qjJocCadnHP6U3O6lVcMCegpkMkOQu7bxSBwRkVJJcIY9gqADYPrQSOLVGW9qcajPWkWhjniqznmp3NVnPNS2aJIrynmoJDxViUiq7kbakopRjbcvJ2CnisHWoQ2nQuQSXBrpVUeXK/4Vmajbh9LX/YBqkQzyy4zFcrL2jJOPWpVmSSJCV53ZqxrFviEADliap2cJfOemMVtFmEjJnGL7cDxurpoTut0PtWBcQFJzn+9W9bc26fStEZMnNJQaKYgoopDQAZpM0UlACZooooASilpKAExRS0lADTRQaKACiiigApKWkoAKKKKACiiigAooooAQU6minUALRmkooAO9OptOoAWiiigAooooAUHFGaSgUAOooooAKKKKAClpKWgAozRSCgB1FAooAKKKKAClPABpKVuQKAGMdsbOelcfeXGdVAGdr5rrbg7bV/pXFykG9V/TNJjQRMyzkscmU44rYsVPnIG5OccViWpLSoT2Y10OmDdcrxnmpZcT0LSIkjtkYjOeOK3LlWjWNVGQ3JxVPSLX93Fnpwa0iC12VzwG4qGjWLHS/vFjjXgqO9OhRsfMMfWluHhhmxI4Vh6U6O7i3EAl1H6fSs2ja5ZRNvufQVZVTgcc+lQxSJIuQRGvr0apxcxoPlO/wD2m60rBcnTJHSrKYA5qkLsHtT1uQxxTEXcr2oJYjANV1kB71MrDPWmJoUpwPWn5yADSbxTS4oJsPNRmmF/emF+etA7DGbPtUDg9uatMquOuKhYMn3eakdylKD6gVVkJxV2UDqwwaqSj5enFKxTYxSfsUvruFQzRltKuenGKsbQLRgO5zVYkta3Ef8AeqkZtnnuqx/vAhIznisgP9mLx9yOMVd1aRvtuPQ1kX83lNvNaxMWE4L7fXNa1qCIFB9KxY5RMisPWtu3/wBWv0rRGbJD1opT1pKYgpDSmmk0AFITRSGgAzRmkooAWkoooAKTNLTaACkpaSgAooooAKKKKAExRilooASiigUAGaTNBpKAFFOpop1ABRRRQAU6kooAcKKQdKWgAooooAKBRQKAHUUUUAFFFFABS0lLQAUUUUAFLSUtABRRRQAUEgYzRShckUgK92rNbOF64rhp22S8/wAJ5rvroYicD0rgJl3STA9QaqyGixCh8tSnUmuq8Kwi51BARlR1rmEO2Jsfwiu++H9uDC8zL93nNTbU0SR31liISFuEVDg1l/bZru/itrMb5mIPJxxV+9bybBjnBfn8K5myuTZalHcxyYl3AKPas5FJmvqum3tnqzyX7EK3KKDnNU21K9VNsNmEPZwea0NQ1W4vtScyv80ZwARV2CRTgOy5PfHSs2bLVHF3es6taSbpo5HPY4NRp41vkbDwOPcg16MsCXEJPmKQP49nSud1XQJrpSLe4UsOc7AKaVyW2Zln41Z2Akjk/BTXS2mtrOobDAfSuEuNH8V2hbyJVZe3ApLS8120bN7dCPH+yKGkVG7PTob4tyN35VeiujkE5xXD6b4nhYiObUwW9Nldjp97HIqsE8xT1apHJNGg8uxNxBwfamG4Gwnn8qt3V9EtsAsYrFvNQ2x53BfaglXe5YNwcZqs+oohOSfyrn9Q1y7giMkcQdR6MK4+88f3CyFFhYEe1MbPRm1mPaWLkAe1R/29tjLowKj1ryseLNSu5CIrZnB7Vq2KardIXNuy57ZoshHoaa/Z3CAyPhvpSy3b7Q20GE9COtcpb6dPAAXjPPJrWjuprRkd4t0a9s0NJBdm00ieSgwQGGRkYptugMmD0ZTVXxHraXNjamBNjEDOO1RaPqPnTOh57CmkSzzfXiYtVdWGMNWJqrrLDtQ/OBXU/EC2+y6irqMbjXG3h2zA9iorVIxZJZuqxLGT845NdJb/AOqQ+orl7dg10uO4xXURcQqPQVRDHkjJopPeimIDTTSmkoASg0UUAJRS0lABRRRQAU2nU2gApKWkoAKKKKACiiigAooooASgUUCgBDSUppKAHUtJRQAtFFFAC0UUUAKOlLmm0UAOopB0paAClpBS0ALRSUUALRSCloAKWkooAWikpaAClpKKAFopKWgApQG7CkoPC9eTQFriY8zfnoBXDXSFNRnXHyk8V6ZHp0UlhvjkBk7jNcBr1m0eoYXjmpuaKGhSgYvEwPU8V674JtvK0YfJy/Brya1g8+5ZFOAAMV7h4PhA0qIHonLUwWjIfE8wSGNEPRAK5CBne6iHcOPm9Oa6nxEA7Nj+9x9K5jTrR7/XYLFZRAxYMZH+7gHp9aykaJFjVNXePWJ4IvmYEBmHan/b4rGOO41S42xnJC5wWqbx5pF14e1eOTRbV7u6uBliBuVP96sPT9FlvreZ9QJaVx909B9BQkOTstDp9F+LWlQodPtNMknkc7UQNyxqeXxZbahd/ZJh9knPItyfmB+teZ3mgQpAGiuUtLiFyysTg1t+GtBGoatbku7yx4d7gnII9M1VjJTZ0N5HcrI3lXBZ/wC5nmsW4VZCVug6S57muy1HR5bSZpbM+Yp+8h5ZvpWjpfhi11jTZJHia3lHO2b7wrF3ubxnZHmItGtrhWiG4k8CvSdA+1CJEnQxuRwDWfaabaaVq0fnxtcMSSGXleK6iPxBFqkkclrAsQjOCGHJ+lBXO2ac3Fp82Dgc1w3iZZ/s5ljDCPpu7Cu+eVmtjvUcjpisq51OCewnsHtgQykbtvT3oDmaPHTHeAiVJWPPUnitS3UyqBqCxuv+yoBrXOgXrsI7SEzRqPvoMgD396jl0pLZwsr7GHRHPLUkNNF3Shoqyj7JCAffmu3ttIQ2X2hFVjjhRXl2tate6TYxzafY+Q0vAMqZ6VhQfETVbW3eKeY/2m/+rjU4X8q0UTOcrHq9xeQKxWaPYAcZNZ1w8cxKxnch964XSfG17rMrLeweXfxjmQriPH09aufby1xG4LxXTSAFWPyuvqB6VLiylJHQ6hImIIVHCpim6TMtveKAc81Qvr3dcONuGQ4xS6ed86epNVEUiz8TbMGyS5AztGSfSvIri4aV8d9vFe4eNoDceGHJ5O2vB7hjHc/TitkYMvWLBbqJWOCSK65TwR71yuiw/abxXI+6c11iMpdgR0oJY4jCjNJkUmSTzSUyRcikpKKACig0lAC0lFFABRmg9KbQA7NNoooAKSlpKACiiigAooooAKKKQ0AFFFFACGkpTSUAOooooAWiiigBaKSigBaKKKAFHSlpB0paAAUtJRQAtFIKWgAFLSCloAKKKKAClpKKAFopKWgApaSloAKX5Swz9KShcB+etA47mTc6rPo2ojLFo3PT0qDXj9uRLu35BGeKl8Q2MkyCUA5bgVcMAs9J0m02AEq3mn+VYt6nWlocrp7N55bO3Hc96938MoU0FWII81dua8PSBv7RWAKQu/rXu2mbotEt4VyzYHH4Vad0c7+Izr6DznYHqg496pDR402XWWWfGVA7V0TxRwkSP8znt6VXkRi+487uR7VnI3ijnZIL6NnuJLuZpXOfvVegvYmQedEiY9Bya1DbLIORTP7KifOVye1LmKcSez8M6Vqlo15NHER3VhzRbPp+ngx2NsodT/d4Iq3p1hIlrMA3GOlKlnHjgfN3NUpEcqIzey3LA+SqcclRyPpU6T+TFnc+4jH1+tGzY2BUV1kAsfSoky0tDLmxE8t93g4Cnoc0zQfkdvlALHP0pdQYDT0Q/wDLbk/hTNEcsAT1zipuaKKSOxkBa2U5NYjxhLwqcYcY5roIhm0Fc5qr+VcRv/dbNMnc3dLuUsYXtwqj/GsK80WG5vHuJpV3E5IY9PpV5SHaOb++uajmtvPOapEJWKGsaL/bOl/ZWZCyj92VPSvPJfC+o29y0k+nRyP92OZUzjHvXoslndWzl7eVtvpmrr680GiGN7fc3I5FaKRlOHMcJYeGXtIXkmRPOlGBkcA+9TeGdMg07XS+uXNvJbj5lbdllPYD2q9LdXE+clsHt6VUOlxXJ/eQBvqKUqnkXGlbqReImt/7bkltPnt5TuDLyKk023ZpBKAQB0NXrfSo44vJZcIfuj0rRisGt41QcpUJ3G1Yk18b/DJD/wB014HdwhrmT/eNe/64hm8PyoOirzXhYiNzqBC8Ycg/SttkYbs6Lwfpfmvkr1FdDrWlxWZRopFbI+bB6ViNrCaXbi3tuJyvUVDZG9lt5ZbqQnc2cE1KncuVO0blnIzxSUny7Fx+NFWjnTuFFFFMYGkpTSUAFFFFAAelNpx6U2gAooooAKSlpKACiiigAooooAKQ0tIaACikNJ2oAU0lFJQA+im06gBaKSigBaKKKAFopvelFADh0paQdKWgAooooABS0lFACilpopaAFopKWgAooooAKWkpaAClpKKAFprjgOOxxS0fdoC+povEl1DCuOnJqtrE9osb7zhkHy1b0590bLWXe6Y1xfpE/KOc1hLc7YfCSeGfD9z4pzdWMeBEec8GvTU3aeFjYDzVQAjNct4d1mXRNU2xYEbAKwArobseZObsH74z9K0ic8tJA+XJlzlvSnxsuz5utUDdEEkH8P60yO88wnJ6HrWczeBrxshNW0ABGMc1kwzg1cikyazNLGna42SjPamBTvxS2xyRSp99v96rRLRG67WzWdezZIQdzWrOe9YV222cv2xUsaWhnaid92YB0TpV/SrcRkehqjaxNPdEnpmuggg2FQOlJIu+hs52WoFc5qy+ZXRuuIBWPcwB2aqM4srWcxex942CVpxEYFY1m/k3TxnoQa0rZsKAep60rhYuLCCOnJoubZTaIrqMEmnRnlKlmPyL9apMVjIewhA4jFRi3VTwMfhWixqNmFSykUGgCktJzn7tTQNt4k5B6UshDZzUIKoDzz2pxIkJqqGHSL1OvyV4dYxtc6nJ5IOC5B4r6A0yS1dbhNSI8rbwDXlVtdaRHqtzHY4CCVscd81rJ6GVON5FG+0dY9XgJBJ8sZq7eQrCY0zgFc4roJIo7qaKWPBAADVhaqRJfkD7sYwKmJdV6WKPTiimrzyeppa2OUWikooAU0lFFABRSHpSUAOPSm0UUAFFFFABSUtFACUUtJQAUUUlAC0hoooAQ0UGkoAKSg0ZoAWnU2nUAFFFFAC0UnelFACd6UUUUAOHSlpoooAdRSCloAKKKKAAUtIKWgApaSigBaKSloAKWkooAWikooAWkJywFFA5BJ4xQIv6VkXG2rOoMtpeJK3boKzbaRo5VkTkgdK17GZdSR1uowpi4yRWMlqddKV0ZqyI7S3BbHTFdibobonY/uTEox61xgthZzXYU7kIG3PNb1lJ52jQ7z/GRn0qkyJrUm1GFoyJo2+Q9/b0qCGRSMoevWnpc+XIYLnmJuFqGSNrSTYB8jcqfaokXDQ1Ldia0YWwaxoJMAYPNakUnyD1rM3ubdm2WWpV6t9ao2Uh81PrVlmYu+0dOTVohjpT+7JrHuIvOibJ71rRqt1MsG7aHHJPf6Vzfi67fQp47eD99EVJbZyVPvRa4uboXrZYYhgEZrYsSknGcseleT2/itZ7gRxPukB5IPArvtN1WOS3WRTmQD5sUrFrVHaS2/7kVh3JMchqVtYZrJGyBzjmue1XXokBJYZ6ZpkpWLlxBtZJR/Ewq6F2yZHQ9K5q18QxOnztuQcE+9dTa/6VZRyohORw3Y/SpsO5Mh+X6VNOeg9qrLnYo96kuW/fjnjAouIjc8VUkfmp2Oc81SnbaaV7lJFeeYqcjoKihkaaUSfwr1pjBpZti/cblj6VHJOolEEXEScKw7/WrijOZa1W6L6beTQ4+RBgV5vDpEsF+zRjG8b+nc11+u3Cxabb24JWSRiG96bbIjyxMcHAA4q2FJW1K32h7KzYyjDba52WQyqW/iY7jWz4lnBYRjisIrkJj0pwRjWneQuckkdD0ooIwcUVqzFhRRRSAKKKKAEPSkpT0pKACiiigAooooAKKKSgBaSiigApKWkoAKKQ0dqAA000ppKAENJQaKAH06m0ZoAdRSUUAHelFFFAC0UUUAKKKBRQAopabRmgB1FIKWgAFLSUUALRSUtABS0lFAC0UlLQAUUUUAFKeV56UlL1GD0oASKQxTKyjK7gK6x7dHt8xptMg5IFcqAAMDitqHVxDZRI7fMByazkjajIq38XkQ7d3zfxVc0CVWsLqBjkIhZT71zuramsxJRzk9a1PDzZZVHAkGCPWki5tXLkjgKvmfMccVdtGF1F9nlPz9j6VlSs0VzICPusce1XLYF8MDtY859amQRZeWMxSeQ3A/vVowkKNnUDv61FbMt9HsdQrp0PrTgGTKsMY6CsmbI1rFh5qfWrLSbXfBHPr3rNgfEiYOKtXBCuc9CKSZVhkk2VkYZUqhwfT6V5hqWo3c97NZTOwaQlo5XPXHYmvSrk4sCn8THI+lcrqWmRXW0Og3DkN6VaYnE81khja78nUVksr1D8v2YYRvrXSW2pX9jab4mSePGP3J3H8a0dR0hNUi8l8LdKP3ch6yfWuMMOo6Nfo9qzosbZkg6Aj3rQi9j0DUNb1CDRbVhaTgyN1ZDXH36azqAL+fDEgbJDNg4rq/EXjeTxFpFnp1lB5Dx43uoxg4qhp3h65vRib5lUZZ34zRoGrMXRPIS98sS3bMOXL/6r869u0HWfP0OOCONAyjEZA4I71wg8PIUSCH5ISQWA/irsNHt1sdkGMRKuBWdymrmugy6Cop2y5NLasTMobnrUMxJMnP0qWwsRSS7aqOfNOBU8i52qBn3qO4KW8XH36EO5RupxCnkRfeblj6VTRNxEK/xnOfSiXIcser8mnWxEbGZuVjB3e9axMZsz9YK3uuwISBDFj+VT391HYxRrBESSfvYrMtUe71O5yxOOQa0dXYwaTtc5Y8KT2qgcuVHMXkklxcM0jAn2qEP29KAeM9+9JgelaJWOaTu7i5zzRRRTEFFFFABRSHpSZoAU9KSiigAooooAKKKSgBaSikoAWikooAWkoooAaaXtSGigANJSmmk0AIaKKKAH0UUUALRRRQAtFFFAC0UlFADhRSCigBaKKKAFFLSCjNAC0UmaKAFpaSigBaKSloAKWkooAWikpaACjNFFNDQoNAVWPz9PSkoPHI61DVxRumVri2geNii8irukzPatET0Vs1EwAXA70+JgD5fc0rFXbZp6i+LxTj/WDdVyCRSEXpgVR1DMtvDcL1TCZpICT94+9RJGkWdDBIGIlHylf1rRLrdqrqMN3FYkLbwNx6VdjuPswaXqP4hWbibotK+wg+hq7O3mzxoO6is674CzQtmNv4fSrjZinWVm2gRAqfepSHewl4f36L2VcGqU0aybiegoN7HI7NJKAxPNWUEEqAKRz1OaqxadzKNiJ9rkYZTwfWpdQ0KDUYWl2YutuJCB94dq1GnsIVK3EyxqvQ1oaTqOlPNE6zpKyng9KepMl2OQ0jwtGZDJMgjjTse9bctuGAQfuoV6YH3q6DUJLGaYyOqoB0YNxVVlguADbyrLgdBxRZjSMsQiFQ3UdhVyKYAKSOvan/ZWB8wr+GaqSSiObew2Y71NguaomVbsqOwqiZWebA7mmNJi3W7A5bv61WileOMzyP8AMT8qenvU2C5pSOIUPdqypizku5/CphcFxuY81Unk3NyapIhsrTyAoSe1Up7ryNIl3H5rjlfwqS6fLD+6TtNZHiOUxJDbKeYeF9s1rFGU5EOk6msbFs/OTg1f17UY7uCGJT8ynJrnY4Ehbco+Y8k1IRucueWIxVxiZVJXVkAHWiiitCFsFFFFIAooooAQ9KSlPSkoAKKKKACiiigApKM0UAFJS0lABRRRQAUUmaM8UAIaSlNJQAhNJQaQ0ALRTcmjJoAlooooAWikozQA6ikzRmgBaKKKAFFFJRmgBRS0gNGaAFozSUuKAClpKM0AOopAaWgApaSjNAC0UmaWgApaSjNAC0UmaWgAoNFAHNACHlwKmaMR3SOehwKhH3s9xVy/jIt7aUd2waTKjuWk+fSZov4g5cfSs+C5wq5q7YzRySTID1iKge9ZTwSxt2G3rUstG9b3PA5q4twDGwPI9K56C4zHleo7VcgmaVowgJZuo9PrWUtjaLNaxuGF0sJ+ZJDge1bfi6wn0zSILhbhQpIyMdR6VhbksACCGlPT2q3/AGvc3EKrc7JUXnY3NQirXOEfxbiVo7XT5zOv8ROQaqyaj4u1NWb7LJ5Q/hRcGu3lh0u7cssKwS+pGBVdUvLGbejhovVelUaR3OOj/tZUzPZXTse2aRLy8hkIeKaBB1ya7+01ZGG24gK49RWjGmlXRO6OMs3Yimb8qPMn1i5kwqzSup4xuNWLfVLmFSUaZG9Cx5r0ZNN0sx5W2jDqem0VHNbaZAu5lgJ64x0NAcqORtvG+t2sYT7O7J3BGTV1fiBYlQt5ZyxyHjLGtZilwfkgjiTvI68GqVxHpkbYFtFJJ3kZQV/CkZySOy0m0+2eGTfs4MTDMS+lc3PeGSdmJ+dvlx6YqSwuZrG2KxyN9nfqhPC/Sq15aiFlliJaAnLE9almD0LnnlVAz2qCafjNVpJwEVl5XOKrSzvyDjB+7iqSJky1Bi7nKE4CqW/EVgX1z9qlkZ+STxW1a5j0+e46ODt/OsC7QRzxBfunNaxRhJjACBg0tJk96M1oZi0UCigAooooAKKQ0ZoAD0pKM0UAFFFJmgBaDSZooATvS0UmaAFpKM0UAFFJmjNACGjtQTSZoADRRSE80AIaQ0E0mc0AFFFFAElKKTNKDQAUUUUALRSUZoAWlFNzTgaAA0UUUAApaSloABS0UmaAFopM0ZoAUdadTQeaXNAC0UmaWgApaSjNAC0UmaWgApaSjNAC0o6im5pQcEE9O9K4CDvWrdLv0kDuvIrLGCMqcitr5fsaxvxxnNNrQqG5zOn3Bg1CIM3VxmtTUnAvJW5KMcgL1rmtQY2d20uSVVtwxXVNYXWoWdlfQxOkbRbpHYYwO+KhlszbWOeaUrGuT2I6D61ovdrpy+XGA9y3+sI5A+lK95bwxGHTshG+9KByazWjdO3I5Y+tZyWhcWaEU/mfPKxL1ZS5CnO7n0rPgjLpvCjHr3proc7lz+NZm0WX55BIudvP+zWa+q3di24EPEP4HNWIpZMYAxT3shcL8yZJp3RXoRDW7bUCFRvLuR/z04Sqc/iJ7GYZhYFerY+U/Q1Zm8OJInMe4dh6Vp+HNMRNXtU1WP7VZq3KOOFFO4c0jLt/FDXcoih8wOf48cD6mrM2vWFm3+kN5t0Oycof/r1e8YafaS6o0Oh2wtYNo3eWMbq5yDwyUUiSPGTn8aLhzSJJfEd3fttjQrEei9q0NLid23TElf7p6U620tYFAK5Aq6WRF2gbR7Urg2y4bhdhi6L2pLW6KkxzHMXvWdIWlYbOlJKwRBuY59KRLLtwFtmMZ5STlT6Zqg5ZbnaTkbeKsx3K3UKwPgL0jk77vT6VU2uuoxRSqd4cA/StI6mUmad3IlvZW8BPMqbm+tcv5rT3Lg9IzxVvXL7fezQg/Mj7Ux6VB9wou3DEfNWq0MJBRQcZ4ORRVEijpS0maM0ALRSZozQAGkoJpM0ALRSZozQAtJRRQAUUUmaAFpKM0UAFFFJmgBDR2oozQAhooJpM0ALTT1o3UhOaAENAopKAFopM0ZoAkpRSUuaAFopM0ZoAWiiigApRSUuaAFopM0ZoAWlpKXNACmkozRQAUUUUAFLSUZoAUdadTc0uaAFopM0ZoAWlpuaXNAC0UmaXPFABS5GVU9GpF+bpTgO20sScD2o5RXJLSEzymFB8vrWrdLJBAI2GR0p86Q6JpYaRgZmGc+lRSSNJZhmbLMMg0S0RpT1Zympw4cmMZI+bFdAPihLcaFbaC+lqFjUK027sO341j3xJDZ+9jGa56eF8AqehyfeoKkd1bSaXcj5MWLN9yMfNuqX7DLGVVow6juD1rjLa9Jx5hwV4X2rU0/xDNaSFYjjPXdzmlJaDi9TqIoIvMChdv+zViWzRsDaBWfDrkWoFY5E8iX/noelagSWKLO8T9949KxaN0yOPT0z0q/HYKACBzVCO+AbBGMVo21+hbkcY61CWpdy9b2iEYYCrlvYxLdJlQRms6O8zlsYXsfWtCCYfaIzvB9q0FcRrKFxI+wBskVG+mRMn3ecUv22JZSCP4jUsl8uzCsFGaB3MmfTdi8isyWyXNbb3izbgGHFVFkSQElelQDZmCy8ocCqlxCqnLjNb4iaWPdEu5fX0qldtZWi7ppllf/nmKdjNsw5YCYx5KE4OfpXWWXh1tQ0GfVZ7lY7iCFlQcdAM1yd7rp/5c4xDGOuea5i51vULp3tYbhwrt8xB4x6VtFWMm7lvRLZ9R1NpZTuEecn1rQumQXDsB04FX9AtI7e1VYz8xGD71X1OzNncFmGVfpWtrmUtCiBgcUtGMUUEhRRRQAUUUmaAA0UUUAFFFJmgBaKTNGaAFpKM0maAFpM0ZpKAFzSUUZoAKDSZoJoAQ0hpc0hNACUlKTSZoAKQ0ZoJoAKKTNGaAJaKKKAFooozQAtFJmlzQAUUUUAKKKSlzQAClpM0uaAAUtJS5oAKKM0ZoAKKM0ZoAKWkzRmgBaQUtFAC0tJmjPPNAC0jndgClb5VznNOO0MmO4zn0oC4wsY8Ada3/DumM8hublcRdeap6Ppkl/fZIxGvO49D9K624KRaPMka7VIG2tVHQxb1PNvF+pvcakluzYG7GPaujkTy7GFf+mY/lXDayfN8TIkh5yM13U8ga2jAB4QCsajOqic3e9TWHPIUyBW5e9TWHdoy/Nxj0qEVIqAFjnOKXziASh+ZaiWTe3HA96SYRvhU3Kf4j61ehCuW4NQkHMh5HpW3p+t3EDK6z8HjDc1yT74x8pBHvU0NwgUbztI/KpcSlJnoX9vW07oL2Fj/ANNI+AK0VeOQB7KZZRj7q9RXmTXe4DazH2zxU8GqSxYxKYyOmw4qHAtTPSRqMkXlQnCleua1LDUkuNRg+YbmOMjoK4Cy8U4h23kauv8AeA5rtvBmi2uuSSajZXBjWIZCytSsy+ZCT3oimkZucOeR0qIag1yuY1Z8H+GsO9v9O068uQ80lxMHb5UbI61nv4mmkHlwrHEOvyjBxRyhzI63cMNJcTrEP7h4NV7fXrW2Z0hByP4nOQa4e41gyyZeRmH1qhc6m6nMPT3pqBk5nY33iSWWPLSbR6JxWLd35kUSLJs93Oa5g3srJtB496dCklwQGc7fQmtFElyZcu9RMrCKJ8g/eIq9pVrEHA3ZJ61m7ERgI06dc10GlRg4KgZ96bshxOr06PYi+WclOK0b61Oo6ezbfnjHy1R0v9267v4iAa6ZYfI1FQceQRwBV09TKqzzgNuyfQ4pa3dc0Ga0uHngTdA3ICjkVhN8hIf5T6Ghp3JTVgopcHGccUhI9c1JQhoo69qT8DQAtFFFAAaSjNGaACijNGaACkozRmgApKWkoAKSjNGaACg0ZpCaAEpKXNJmgBDSUpNJmgApDS5pCaACijNGaAJaKTIpaACiiigBaKKKAFooooAKKKKAClFJSigBaKKKACiiigAooooAKUUlKKAFooxS4oASg8c9aQkL1qaGF5mCwIWJ9qaQmxgkLDAQfjViwsXvbpYVHysfmPpWnb+G5SvmXkvlL/sHJrotP02CwtwICXaQ/eIwcVSiRKRYgtYrOBbaIDMS43etQah82nQjoWBzVyQGOOQjnyztJqlqR3WtsE64Oa2toZSZ4xrzs3jCNU7MM13gmD2yeygVxuqRKvjCVm9sVvQTfugM1xz3O6l8JBejk4rGn689K3LgqwrIulGMVKZbRiXJ+bKVCJgfqKuSKig5rPcAFitUiB7PuqGQB1APY0iNzzTtwBPGaoQ3c0a8Hiq7XhLbdpzT33E+1KrqBjYM+tBIkV8UBBJOexq9Z+IdS06J0tb54FcYKq2KzSiODkbD6ikkiiIA2iT3NPlDmLsdw7uzPKVZuS+etKLwZYpISQMFs9az/KLrh2yB0WmuoTAQAD0o5Q5i2botyM00yzOcA8VEp+XlQKmhTcepoAtRoSwrRVfLTI61WiUAZPWrMeXOO1K5RYiUORxzXQafDtAxWNawkOOK3bfcqjFZyZUUa0l2ILWMg/MGFduyGWysLgfxA5rzeQNIFX3Br0m0fd4bhxnKAYrooGFYlIYyzowDKFGAapXug2F0QzxBHYdQKulw7sRkFlAzRPLiBtxyyjjNbuJzKRx974RuoCzwybl6hc1gz2r2zEXCOhHoK9JVnng80OV2jtTC1tPFtuLOOUH+JutZuBopnmeRJwrYx60APH15Fdne+EoLn57P5XPO3tXJ3drPp101vcowI744qHGxalciO3GR1ppo5Dn0pCw61DLQUUDkZHSjFJAwooopgFJRmigApDRmjNACUUUUAFIaWkJFACUlGRSZoAKSlpKACkNLSUAFFGaTNAEtLSUuRQAUUZooAcOlFIKWgAoozRQAUtJS0ABpRSUooAU0lGaKACiiigApaTpyaUDIyKADOOaD84yOKMcUhORtXk0AKoXPLYNPwZGAALMejDvV+w8P3NyBI6EIT1rrdP0KCwAkVQSf4jzWkY3IlKxgaZ4Xu7wAzL5Kn+H1rqbWwtrOIrbQBiBg545qxI5MYBkCoegx1qK4kDQgjlTwCOK2jAwlMqxxLJckvB5Zz1zmtNsAgDnauazrLc02Ac+1Xg58yQY6KacopEKTbIGZpLSV/wC81VdQG2ztvUg0/wC1Y0mbaMsrCo7xjPaWEuPkwdx9Kb2Kb1PLNfhMfiqVscYFX4zhBT/F8Qi1iKbGFkOAfWoIs7RmvPqbno0fhHyciqNwmRV9ulVJ1JHyjNQjRoyZoc5rOlh25rYdW54qjMnXiqRDRlBcNQalZSGPFMwd1aEETCoiMVYYVCynFBIzNNY8UpB9KaRVXCwgfikOTzRtyeKsRwsV6UXCw2JCwq9bw4ogh2jkYqwoxSZSFiBNaNrDuNV4YvatS1jcfw1k2UkWIEAOMVoIpxxUEMPOQKtI2Bx261k2aJFqwhM10o9BzXfRSGHQAoHTH864rQbV3M856buK7mGLOkhCeSMgV20DjrtA0qySccFQM0hQXVnJk4IBrLWRgJ5iccYHvWmh82FwDtxGDXSctijos7SO8cnQPt/CrmowGCZVUcMc1m2DMNSCFdq55NdDfBHAJPzAfL7igDPuJJLSWLaceYMg1ZvdNg1Wyj+0ABnH3qVYf7S0ySNk/fR/6s+1VNNuiunSWk2WkjPHtScUxqTRx2t+HrjTHyCWgP3TisNSrZXPIr150tprcRXI3gj5faudvPBNvKzSQOEJ5xWUoGsZnBtuVdpXI+tKu0jpiukPg6dt3l3AbBxjFUp/CupxfdQuPas3FmikjGxhutFTz2dxZnFxCyH1NQ4JGR0qbDuNoNKBu6Uh4PNAxKKKQkA4oAWjNFNoACaSg0maACkpaSgApDS0lABRRRQAlJS0lAEtFFFACilpBS0ALRRRQAlKKSlFAAaWkNLQAtFFFABRRRQAUCigUAOwD1oJ3cDgCihgD8vY1SVyW7D4IpLiVY4VLEnHFdtofhSOEfaboAnrtNReE7G3jQOEy3qea6KCZzfshPy+laRgRKZGJYpJvs6LsA4Apl2TbSCInocVVYldeIHTNT3H768cvzhhW1rHO3cl1ELHbxADkVTkAWKOLPIOavat8twqAcACqk6g6pt7bBQBRt7lYLp8tVhp2N8u0/K6ZqpcQR/apOD0p28rFG4+8pCg+1AIu28OyyukYDJao5pcWVuAB5a5yKzp7qb7TIm/CkE8VU0+R5bG5DuxCkY5oiD3K3jOxFxoVpdKvzQMWb6Vyts/7pec16XPCl14a1JZRkCIYry6D5QVHQHArir7noUX7pezkVE/3TT16Uj/AHTWCOlFF1zmqMyda1CBVOdRiqREjHZPmNQlOausBuNQkDNUjNlZkqJ0OOKuMBUeBVCKZiY00QNuzir4Ap+0Y6UyiksLE/dq5EjDAxUsYFOPFADHGDxUsUe6kADHmrcKgYqWJE0MWCK1IEO2q8SjIrQiAxWbNETBcAFakZMABerU0HCnFW9LQTXHz84qHuV0Og0218nT0UcMwya3bhzBokUgPzYxWfgJGmPSrd7zpUIPSvQpfCebV+IpRpI4t7UYyxJar9qyvDeA9UjxxVW3GLqSXJ3KoxTtLY/ZL1+rEHNboxkUrCTOpADOMd66HUTsMDeqVzen83rN3xXRapzb2p77RQQiayk+zvGT91hg1m6jbta6jKU6Hk1cIzprOfvKwxT7v94NzclhzU9TToQafMLoGE/6ztWrduLeGP1PymsOzAg1u1Kcbm5rSvmMkrBugYkU2JCyxxmASR9Afmx61HCTcB1jzlafZHFhOOvzE81HprkXgAwAynNJIdyJoYLq38m4hDM3fHNc1qPg6QOz2DA99vWulVzHfkjnBxzV2/H2ebdESpYDPNQ4msZHls3h/UIZD+6ZmHOFFUJre4gf99A6fUV6/dYjdSFGWUZJFU5I4peJIIn/AN5c1PKU5HlBAYcZpFULyTk16Le6Dp80buYipAJ+Q4rg762jt2xHn8TUOA1Mr538dKbQT8uaKi1i07iGm0402gYUUUUAFFFFACGkpTSUAFFFFAH/2Q==';

      const alert = await this.alertController.create({
        header: 'Notificar ausencia',
        message: '¿Esta seguro que desea continuar?',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'secondary',
            handler: (blah) => {
              this.check_ruta ();
            }
          }, {
            text: 'Confirmar',
            handler: async () => {
              const loading = await this.loadingController.create({
                message: 'Actualizando informacion ...',
              });
          
              await loading.present ();
              
              const filePath = '/Imagenes/' + this.cliente_actual.id + '.jpg';
              const storageRef = this.af_storage.ref (filePath);
              const uploadTask = storageRef.putString (imagen, 'data_url');

              uploadTask.snapshotChanges ().pipe (
                finalize(async () => {
                  let download_url = await storageRef.getDownloadURL ().toPromise ();
                  console.log (download_url);

                  this.database.update_cliente_cardex_ruta (
                    this.route.snapshot.paramMap.get ('tipo'),
                    this.item,
                    this.cliente_actual,
                    'hora_ausencia',
                    '',
                    download_url
                  )
                  .then (async () => {
                    this.presentToast ('La notificacion fue enviada');
                    await loading.dismiss ();
                    this.check_ruta ();
                  })
                  .catch (async (error: any) => {
                    await loading.dismiss ();
                    console.log (error);
                  });
                })
              ).subscribe ();
            }
          }
        ]
      });

      await alert.present ();
    }, (err) => {
      loading.dismiss ();
      console.log ('Camera error', err);
    });
  }

  async eventos () {
    const actionSheet = await this.actionSheetController.create({
      header: 'Eventos',
      // subHeader: '¿Que evento desea registrar?',
      mode: 'md',
      buttons: [{
        text: 'Almuerzo',
        icon: 'restaurant',
        handler: async () => {
          if (this.almuerzo_disponible === null || this.almuerzo_disponible === undefined) {
            this.agregar_evento ('almuerzo');
          } else {
            const alert = await this.alertController.create({
              header: 'Alert',
              subHeader: 'Subtitle',
              message: 'This is an alert message.',
              buttons: ['OK']
            });
        
            await alert.present();
          }
        }
      }, {
        text: 'Falla mecanica',
        icon: 'build',
        handler: async () => {
          this.agregar_evento ('fallo_mecanico');
        }
      }, {
        text: 'Accidente',
        icon: 'car',
        handler: () => {
          this.agregar_evento ('accidente');
        }
      }, {
        text: 'Recarga de combustible',
        icon: 'water',
        handler: () => {
          this.recarga_combustible_modal ();
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

  async recarga_combustible_modal () {
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

  async agregar_evento (tipo: string) {
    let _inputs: any = [];
    let _nombre = ""
    if (tipo === 'almuerzo') {
      _nombre = "Almuerzo";
    } else if (tipo === 'fallo_mecanico') {
      _nombre = "Falla mecanico";
      _inputs = [
        {
          name: 'motivo',
          type: 'text',
          placeholder: 'Motivo'
        }
      ]
    } else if (tipo === 'accidente') {
      _nombre = "Accidente";
    }

    const alert = await this.alertController.create({
      header: _nombre,
      message: '¿Estas seguro?',
      inputs: _inputs,
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
          handler: async (data) => {
            const loading = await this.loadingController.create({
              message: 'Registrando hora de almuerzo...',
            });

            await loading.present ();

            let motivo = '';
            if (tipo === 'fallo_mecanico') {
              motivo = data.motivo;
            }

            let evento: any = {
              id: this.database.createId (),
              nombre: _nombre,
              tipo: tipo,
              conductor_id: this.item.conductor_id,
              vehiculo_id: this.item.vehiculo_id,
              hora_inicio: moment().format('HH[:]mm'),
              hora_fin: null,
              motivo: motivo
            };

            console.log (evento);

            this.database.add_cardex_event (this.route.snapshot.paramMap.get ('tipo'), this.item, evento)
              .then (() => {
                loading.dismiss ();
                this.open_evento_modal (evento);
              }).catch ((error: any) => {
                console.log (error);
                loading.dismiss ();
              });
          }
        }
      ]
    });

    await alert.present ();
  }

  async open_evento_modal (evento: any) {
    let modal = await this.modalController.create({
      component: AlmuerzoPage,
      cssClass: 'modal-transparent',
      componentProps: {
        tipo: evento.tipo,
        evento: evento
      }
    });

    modal.onDidDismiss ().then (async (response: any) => {
      if (response.role === 'ok') {
        const loading = await this.loadingController.create({
          message: 'Actualizando informacion ...',
        });

        await loading.present ();

        console.log (response);

        this.database.finalizar_evento_cardex (this.route.snapshot.paramMap.get ('tipo'), this.item, response.data)
          .then (() => {
            loading.dismiss ();
            this.check_ruta ();
          })
          .catch ((error: any) => {
            loading.dismiss ();
            this.check_ruta ();
            console.log (error);
          });
      }
    });

    await modal.present();
  }

  async presentToast (message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'top'
    });
    toast.present();
  }
}
