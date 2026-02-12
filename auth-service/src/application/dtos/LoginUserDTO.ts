export class LoginUserDTO {
  email: string;
  password: string;

  constructor(data: any) {
    this.email = data.email;
    this.password = data.password;
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.email) {
      errors.push('Email es requerido');
    }
    
    if (!this.password) {
      errors.push('Contraseña es requerida');
    }
    
    return errors;
  }
}
