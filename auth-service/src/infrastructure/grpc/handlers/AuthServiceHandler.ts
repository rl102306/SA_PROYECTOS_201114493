import { RegisterUserUseCase } from '../../../application/usecases/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/usecases/LoginUserUseCase';
import { RegisterUserDTO } from '../../../application/dtos/RegisterUserDTO';
import { LoginUserDTO } from '../../../application/dtos/LoginUserDTO';
import { IJwtGenerator } from '../../../domain/interfaces/IJwtGenerator';
import { IUserRepository } from '../../../domain/interfaces/IUserRepository';
import { UserRole } from '../../../domain/entities/User';

export class AuthServiceHandler {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly jwtGenerator: IJwtGenerator,
    private readonly userRepository?: IUserRepository
  ) {}

  async Register(call: any, callback: any) {
    try {
      const { email, password, first_name, last_name, role } = call.request;
      const dto = new RegisterUserDTO({
        email, password,
        firstName: first_name, lastName: last_name,
        role: role as UserRole
      });
      const result = await this.registerUserUseCase.execute(dto);
      callback(null, {
        success: true,
        message: result.message,
        user: {
          id: result.user.id, email: result.user.email,
          first_name: result.user.firstName, last_name: result.user.lastName,
          role: result.user.role
        }
      });
    } catch (error: any) {
      console.error('Error en Register:', error);
      callback(null, { success: false, message: error.message || 'Error al registrar usuario', user: null });
    }
  }

  async Login(call: any, callback: any) {
    try {
      const { email, password } = call.request;
      const result = await this.loginUserUseCase.execute(new LoginUserDTO({ email, password }));
      callback(null, {
        success: true,
        message: 'Login exitoso',
        token: result.token,
        user: {
          id: result.user.id, email: result.user.email,
          first_name: result.user.firstName, last_name: result.user.lastName,
          role: result.user.role
        }
      });
    } catch (error: any) {
      console.error('Error en Login:', error);
      callback(null, { success: false, message: error.message || 'Error al iniciar sesión', token: '', user: null });
    }
  }

  async ValidateToken(call: any, callback: any) {
    try {
      const { token } = call.request;
      const payload = this.jwtGenerator.verify(token);
      if (!payload) {
        callback(null, { valid: false, user_id: '', email: '', role: '' });
        return;
      }
      callback(null, { valid: true, user_id: payload.userId, email: payload.email, role: payload.role, restaurant_id: payload.restaurantId || '' });
    } catch (error) {
      console.error('Error en ValidateToken:', error);
      callback(null, { valid: false, user_id: '', email: '', role: '', restaurant_id: '' });
    }
  }

  async GetUserById(call: any, callback: any) {
    try {
      if (!this.userRepository) {
        callback(null, { found: false, user: null });
        return;
      }
      const user = await this.userRepository.findById(call.request.user_id);
      if (!user) {
        callback(null, { found: false, user: null });
        return;
      }
      callback(null, {
        found: true,
        user: {
          id: user.id, email: user.email,
          first_name: user.firstName, last_name: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      callback(null, { found: false, user: null });
    }
  }
}
