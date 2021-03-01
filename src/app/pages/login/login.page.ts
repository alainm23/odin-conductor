import { Component, OnInit } from '@angular/core';

// Services
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { NavController, LoadingController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  email: string = "";
  password: string = "";

  constructor (
    private auth: AuthService,
    private navCtrl: NavController,
    private database: DatabaseService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
  }

  async onSubmit () {
    const loading = await this.loadingController.create({
      message: 'Procesando...',
    });

    await loading.present();

    this.auth.signInWithEmailAndPassword (this.email, this.password)
      .then (async (res: any) => {
        this.database.isUsuarioValid (res.user.uid).then (async (usuario: any) => {
          console.log (usuario);

          await loading.dismiss ();

          if (usuario.tipo === 3) {
            this.navCtrl.navigateRoot ('home');
          } else {
            this.auth.signOut ();
            this.email = "";
            this.password = "";
          }
        });
      })
      .catch (async (error: any) => {
        await loading.dismiss ();
        console.log ('signInWithEmailAndPassword', error);
        this.password = "";

        const alert = await this.alertController.create({
          header: 'Error!',
          message: error.message,
          buttons: ['Ok']
        });

        await alert.present();
      });
  }
}
