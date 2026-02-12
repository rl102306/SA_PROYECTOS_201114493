import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Login exitoso');
          const user = response.user;
          
          // Redirigir según el rol
          if (user?.role === 'ADMIN') {
            this.router.navigate(['/admin']);
          } else if (user?.role === 'CLIENT') {
            this.router.navigate(['client/orders']);
          } else {
            this.router.navigate(['/']);
          }
        } else {
          this.errorMessage = response.message || 'Error al iniciar sesión';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error en login:', error);
        this.errorMessage = error.error?.message || 'Error al iniciar sesión';
        this.isLoading = false;
      }
    });
  }

  goToRegister(): void {
    this.router.navigate(['register']);
  }
}
