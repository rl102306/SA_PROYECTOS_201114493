import { Pool } from 'pg';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';
import { IPasswordHasher } from '../../domain/interfaces/IPasswordHasher';
import { IJwtGenerator } from '../../domain/interfaces/IJwtGenerator';
import { PostgresUserRepository } from '../database/postgres/PostgresUserRepository';
import { BcryptPasswordHasher } from '../adapters/BcryptPasswordHasher';
import { JwtService } from '../adapters/JwtService';
import { RegisterUserUseCase } from '../../application/usecases/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/usecases/LoginUserUseCase';
import { AuthServiceHandler } from '../grpc/handlers/AuthServiceHandler';

export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  register(pool: Pool): void {
    // Repositories
    const userRepository: IUserRepository = new PostgresUserRepository(pool);
    this.services.set('UserRepository', userRepository);

    // Adapters
    const passwordHasher: IPasswordHasher = new BcryptPasswordHasher();
    const jwtGenerator: IJwtGenerator = new JwtService();
    this.services.set('PasswordHasher', passwordHasher);
    this.services.set('JwtGenerator', jwtGenerator);

    // Use Cases
    const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
    const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, jwtGenerator);
    this.services.set('RegisterUserUseCase', registerUserUseCase);
    this.services.set('LoginUserUseCase', loginUserUseCase);

    // Handlers
    const authServiceHandler = new AuthServiceHandler(
      registerUserUseCase,
      loginUserUseCase,
      jwtGenerator,
      userRepository
    );
    this.services.set('AuthServiceHandler', authServiceHandler);
  }

  resolve<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found in container`);
    }
    return service as T;
  }
}
