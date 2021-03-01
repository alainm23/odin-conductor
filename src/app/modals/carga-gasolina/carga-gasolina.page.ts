import { Component, OnInit, Input } from '@angular/core';

// Services
import { DatabaseService } from '../../services/database.service';
import { LoadingController, ModalController, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import * as moment from 'moment';
import { CallService } from '../../services/call.service';
import { AngularFireStorage } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';

// Camera
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';

// Forms
import { FormGroup , FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-carga-gasolina',
  templateUrl: './carga-gasolina.page.html',
  styleUrls: ['./carga-gasolina.page.scss'],
})
export class CargaGasolinaPage implements OnInit {
  @Input () carro_id: string;
  @Input () tipo: string;
  @Input () cardex: any;

  items: any [] = [];
  form: FormGroup;

  imagen: string = '';
  constructor (
    private loadingController: LoadingController,
    private modalController: ModalController,
    private toastController: ToastController,
    private phone_service: CallService,
    private camera: Camera,
    public alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private af_storage: AngularFireStorage,
    private database: DatabaseService) { }

  async ngOnInit () {
    this.form = new FormGroup ({
      vehiculo_id: new FormControl (this.carro_id, Validators.required),
      kilometraje: new FormControl ('', Validators.required),
      numero_galones: new FormControl ('', Validators.required),
      nro_boleta_factura: new FormControl ('')
    });

    const loading = await this.loadingController.create({
      message: 'Procesando...',
    });

    await loading.present ();

    this.database.get_carros ().subscribe (async (res: any []) => {
      console.log (res);
      this.items = res;
      loading.dismiss ();
    }, error => {
      console.log (error);
      loading.dismiss ();
    });
  }

  get_hora () {
    return moment ().format ('LT');
  }

  get_fecha () {
    return moment ().format ('LL');
  }

  async presentAlertConfirm () {
    const alert = await this.alertController.create({
      message: '¿Esta seguro que desea continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {
            console.log('Confirm Cancel: blah');
          }
        }, {
          text: 'Continuar',
          handler: () => {
            this.submit ();
          }
        }
      ]
    });

    await alert.present();
  }


  async submit () {
    const loading = await this.loadingController.create({
      message: 'Procesando...',
    });

    await loading.present ();

    let data: any = {
      id: this.database.createId (),
      vehiculo_id: this.form.value.vehiculo_id,
      kilometraje: this.form.value.kilometraje,
      numero_galones: this.form.value.numero_galones,
      nro_boleta_factura: this.form.value.nro_boleta_factura,
      fecha_registro: moment ().toISOString(),
      hora_registro: moment ().format ('HH[-]MM'),
      mes: moment ().format ('MM'),
      anio: moment ().format ('YYYY'),
    }

    const filePath = '/Imagenes/' + data.id + '.jpg';
    const storageRef = this.af_storage.ref (filePath);
    const uploadTask = storageRef.putString (this.imagen, 'data_url');

    uploadTask.snapshotChanges ().pipe (
      finalize(async () => {
        let download_url = await storageRef.getDownloadURL ().toPromise ();
        console.log (download_url);

        data.imagen = download_url;

        this.database.add_carga_gasolina (data)
        .then (async () => {
          this.presentToast ('Registro exitoso');                                                                                                
          this.form.reset ();
          await loading.dismiss ();         
          this.modalController.dismiss (null, 'evento');
        })
        .catch (async (error: any) => {
          await loading.dismiss ();
        });
      })
    ).subscribe ();
  }

  close () {
    this.modalController.dismiss ();
  }

  async presentToast (message: string) {
    const toast = await this.toastController.create({
      message: message,
      color: 'success',
      duration: 2500
    });

    toast.present();
  }

  call () {
    this.phone_service.llamar ();
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

    this.camera.getPicture(options).then ((imageData) => {
      this.imagen = 'data:image/jpeg;base64,' + imageData;
    }, (err) => {
      loading.dismiss ();
      console.log ('Camera error', err);
    });
  }
}
