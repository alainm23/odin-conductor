import { Injectable } from '@angular/core';

// Firebase
import { AngularFireAuth } from '@angular/fire/auth';

// Utils
import { first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor (
    private afAuth: AngularFireAuth
  ) { }

  async isLogin () {
    return await this.afAuth.authState.pipe (first ()).toPromise ();
  }

  signInWithEmailAndPassword (email: string, password: string) {
    return this.afAuth.auth.signInWithEmailAndPassword (email, password);
  }

  signOut () {
    return this.afAuth.auth.signOut ();
  }
}
