import { Component, OnInit, Input } from '@angular/core';

// Services
import { AlertController, ModalController } from '@ionic/angular';
import { CallService } from '../../services/call.service';

@Component({
  selector: 'app-almuerzo',
  templateUrl: './almuerzo.page.html',
  styleUrls: ['./almuerzo.page.scss'],
})
export class AlmuerzoPage implements OnInit {
  @Input() tipo: string;
  @Input() evento: any;

  constructor (
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private phone_service: CallService
  ) { }

  ngOnInit() {
  }

  async submit () {
    const alert = await this.alertController.create({
      header: 'Fin de ' + this.evento.nombre,
      message: '¿Estas seguro?',
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
            this.modalCtrl.dismiss (this.evento, 'ok');
          }
        }
      ]
    });

    await alert.present ();
  }

  call () {
    this.phone_service.llamar ();
  }
}
