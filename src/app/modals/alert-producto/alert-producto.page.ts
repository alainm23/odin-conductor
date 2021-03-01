import { Component, OnInit, Input } from '@angular/core';

// Forms
import { FormGroup , FormControl, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-alert-producto',
  templateUrl: './alert-producto.page.html',
  styleUrls: ['./alert-producto.page.scss'],
})
export class AlertProductoPage implements OnInit {
  @Input() tipo: string;
  @Input() producto: any;

  form: FormGroup;

  constructor (
    private modalCtrl: ModalController,
  ) { }

  ngOnInit() {
    if (this.tipo === 'rechazado_total') {
      this.form = new FormGroup ({
        cantidad: new FormControl (this.producto.rechazo_cantidad),
        motivo: new FormControl (this.producto.rechazo_motivo, Validators.required)
      });
    } else {
      this.form = new FormGroup ({
        cantidad: new FormControl (this.producto.rechazo_cantidad, Validators.required),
        motivo: new FormControl (this.producto.rechazo_motivo, Validators.required)
      });
    }
  }

  submit () {
    let data: any = {
      producto_id: this.producto.id,
      tipo: this.tipo,
      cantidad: this.form.value.cantidad,
      motivo: this.form.value.motivo
    }

    this.modalCtrl.dismiss (data, 'ok');
  }

  eliminar () {
    this.modalCtrl.dismiss (null, 'clear');
  }
}
