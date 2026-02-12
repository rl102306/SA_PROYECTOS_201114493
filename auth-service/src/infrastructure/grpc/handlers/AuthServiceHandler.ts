import { RegisterUserUseCase } from '../../../application/usecases/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/usecases/LoginUserUseCase';
import { RegisterUserDTO } from '../../../application/dtos/RegisterUserDTO';
import { LoginUserDTO } from '../../../application/dtos/LoginUserDTO';
import { IJwtGenerator } from '../../../domain/interfaces/IJwtGenerator';
import { UserRole } from '../../../domain/entities/User';

export class AuthServiceHandler {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly jwtGenerator: IJwtGenerator
  ) {}

  async Register(call: any, callback: any) {
    try {
      const { email, password, first_name, last_name, role } = call.request;

      const dto = new RegisterUserDTO({
        email,
        password,
        firstName: first_name,
        lastName: last_name,
        role: role as UserRole
      });

      const result = await this.registerUserUseCase.execute(dto);

      callback(null, {
        success: true,
        message: result.message,
        user: {
          id: result.user.id,
          email: result.user.email,
          first_name: result.user.firstName,
          last_name: result.user.lastName,
          role: result.user.role
        }
      });
    } catch (error: any) {
      console.error('Error en Register:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al registrar usuario',
        user: null
      });
    }
  }

  async Login(call: any, callback: any) {
    try {
      const { email, password } = call.request;

      const dto = new LoginUserDTO({ email, password });

      const result = await this.loginUserUseCase.execute(dto);

      callback(null, {
        success: true,
        message: 'Login exitoso',
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          first_name: result.user.firstName,
          last_name: result.user.lastName,
          role: result.user.role
        }
      });
    } catch (error: any) {
      console.error('Error en Login:', error);
      callback(null, {
        success: false,
        message: error.message || 'Error al iniciar sesión',
        token: '',
        user: null
      });
    }
  }

  async ValidateToken(call: any, callback: any) {
    try {
      const { token } = call.request;

      const payload = this.jwtGenerator.verify(token);

      if (!payload) {
        callback(null, {
          valid: false,
          user_id: '',
          email: '',
          role: ''
        });
        return;
      }

      callback(null, {
        valid: true,
        user_id: payload.userId,
        email: payload.email,
        role: payload.role
      });
    } catch (error) {
      console.error('Error en ValidateToken:', error);
      callback(null, {
        valid: false,
        user_id: '',
        email: '',
        role: ''
      });
    }
  }
}
