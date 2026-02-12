import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { IPasswordHasher } from '../../domain/interfaces/IPasswordHasher';
import { IJwtGenerator } from '../../domain/interfaces/IJwtGenerator';
import { LoginUserDTO } from '../dtos/LoginUserDTO';

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly jwtGenerator: IJwtGenerator
  ) {}

  async execute(dto: LoginUserDTO): Promise<{ token: string; user: any }> {
    // Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }

    // Buscar usuario
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    // Verificar contraseña
    const isValidPassword = await this.passwordHasher.compare(
      dto.password,
      user.password
    );
    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    // Generar JWT
    const token = this.jwtGenerator.generate({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    console.log(`✅ Login exitoso: ${user.email}`);

    return {
      token,
      user: user.toJSON()
    };
  }
}
