import { UserRole } from '../../domain/entities/User';

export class RegisterUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;

  constructor(data: any) {
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role;
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Email inválido');
    }
    
    if (!this.password || this.password.length < 8) {
      errors.push('La contraseña debe tener al menos 8 caracteres');
    }
    
    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('El nombre es requerido');
    }
    
    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('El apellido es requerido');
    }
    
    if (!Object.values(UserRole).includes(this.role)) {
      errors.push('Rol inválido');
    }
    
    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
