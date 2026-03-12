import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      role: ['CLIENT', [Validators.required]],
      restaurantName: ['']
    }, { validators: this.passwordMatchValidator });

    // Actualizar validación de restaurantName cuando cambia el rol
    this.registerForm.get('role')!.valueChanges.subscribe(role => {
      const restaurantNameCtrl = this.registerForm.get('restaurantName')!;
      if (role === 'RESTAURANT') {
        restaurantNameCtrl.setValidators([Validators.required, Validators.minLength(2)]);
      } else {
        restaurantNameCtrl.clearValidators();
      }
      restaurantNameCtrl.updateValueAndValidity();
    });
  }

  get isRestaurant(): boolean {
    return this.registerForm.get('role')?.value === 'RESTAURANT';
  }

  passwordMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const { confirmPassword, ...registerData } = this.registerForm.value;
    // Si no es restaurante, excluir restaurantName del payload
    if (registerData.role !== 'RESTAURANT') {
      delete registerData.restaurantName;
    }

    this.authService.register(registerData).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = '✅ Usuario registrado exitosamente. Redirigiendo al login...';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.errorMessage = response.message || 'Error al registrar usuario';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error en registro:', error);
        this.errorMessage = error.error?.message || 'Error al registrar usuario';
        this.isLoading = false;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
