import { Component } from '@angular/core';

import { Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

// Services
import { OneSignal } from '@ionic-native/onesignal/ngx';
import * as moment from 'moment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private oneSignal: OneSignal
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();

      // Init Services
      if (this.platform.is('cordova')) {
        this.initNotifications ();
      }

      if (this.platform.is('android')) {
        this.statusBar.overlaysWebView(false);
        this.statusBar.backgroundColorByHexString('#000000');
      }

      moment.locale('es');
    });
  }

  initNotifications () {
    this.oneSignal.startInit('0487d9ef-b2e5-4f0f-9c0e-f51a243fe2e2', '475514922269');
    this.oneSignal.inFocusDisplaying (this.oneSignal.OSInFocusDisplayOption.Notification);
    this.oneSignal.handleNotificationReceived ().subscribe(() => {
      // do something when notification is received
     });
     
     this.oneSignal.handleNotificationOpened ().subscribe(() => {
       // do something when a notification is opened
     });

     this.oneSignal.endInit();

     this.oneSignal.getTags ().then (data => {
      console.log (data);
    });

    this.oneSignal.sendTag ("conductor", "true");
  }
}
