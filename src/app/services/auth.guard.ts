import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

// Services
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor (
    private authService: AuthService,
    private router: Router) {}

  canActivate () {
    return this.authService.isLogin ()
      .then (async (user: any) => {
        if (user) {
          return true;
        } else {
          console.log('User is not logged in');
          this.router.navigate(['/login']);
          return false;
        }
      });
  }
}