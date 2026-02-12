import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { IPasswordHasher } from '../../domain/interfaces/IPasswordHasher';
import { RegisterUserDTO } from '../dtos/RegisterUserDTO';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(dto: RegisterUserDTO): Promise<{ user: User; message: string }> {
    // Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Hashear contraseña
    const hashedPassword = await this.passwordHasher.hash(dto.password);

    // Crear usuario
    const user = new User({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role
    });

    // Guardar en repositorio
    const savedUser = await this.userRepository.save(user);

    console.log(`✅ Usuario registrado: ${savedUser.email} (${savedUser.role})`);

    return {
      user: savedUser,
      message: 'Usuario registrado exitosamente'
    };
  }
}
