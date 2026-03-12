/**
 * Tests del endpoint de Login — LoginUserUseCase
 * Cubre: credenciales válidas, usuario inexistente, contraseña incorrecta,
 *        campos vacíos, estructura del token devuelto.
 */

import { LoginUserUseCase } from '../src/application/usecases/LoginUserUseCase';
import { LoginUserDTO }     from '../src/application/dtos/LoginUserDTO';
import { IUserRepository }  from '../src/domain/interfaces/IUserRepository';
import { IPasswordHasher }  from '../src/domain/interfaces/IPasswordHasher';
import { IJwtGenerator }    from '../src/domain/interfaces/IJwtGenerator';
import { User, UserRole }   from '../src/domain/entities/User';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────
const VALID_USER = new User({
  id:         'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  email:      'cliente@test.com',
  password:   '$2b$10$hashedpassword',
  firstName:  'Juan',
  lastName:   'Pérez',
  role:       UserRole.CLIENT
});

const mockUserRepo: jest.Mocked<IUserRepository> = {
  save:           jest.fn(),
  findByEmail:    jest.fn(),
  findById:       jest.fn(),
  existsByEmail:  jest.fn()
};

const mockPasswordHasher: jest.Mocked<IPasswordHasher> = {
  hash:    jest.fn(),
  compare: jest.fn()
};

const mockJwtGenerator: jest.Mocked<IJwtGenerator> = {
  generate: jest.fn(),
  verify:   jest.fn()
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('LoginUserUseCase', () => {
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new LoginUserUseCase(mockUserRepo, mockPasswordHasher, mockJwtGenerator);
  });

  // ── Login exitoso ──────────────────────────────────────────────────────────
  describe('login exitoso', () => {
    beforeEach(() => {
      mockUserRepo.findByEmail.mockResolvedValue(VALID_USER);
      mockPasswordHasher.compare.mockResolvedValue(true);
      mockJwtGenerator.generate.mockReturnValue('jwt.token.mock');
    });

    test('devuelve token cuando las credenciales son válidas', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'password123' });
      const result = await useCase.execute(dto);
      expect(result.token).toBe('jwt.token.mock');
    });

    test('devuelve datos del usuario (sin password) en el resultado', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'password123' });
      const result = await useCase.execute(dto);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('cliente@test.com');
      expect(result.user).not.toHaveProperty('password');
    });

    test('llama a findByEmail con el email correcto', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'password123' });
      await useCase.execute(dto);
      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('cliente@test.com');
    });

    test('llama a compare con la contraseña en texto plano y el hash', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'password123' });
      await useCase.execute(dto);
      expect(mockPasswordHasher.compare).toHaveBeenCalledWith('password123', VALID_USER.password);
    });

    test('genera JWT con userId, email y role', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'password123' });
      await useCase.execute(dto);
      expect(mockJwtGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_USER.id,
          email:  VALID_USER.email,
          role:   VALID_USER.role
        })
      );
    });
  });

  // ── Usuario no encontrado ──────────────────────────────────────────────────
  describe('usuario no encontrado', () => {
    test('lanza "Credenciales inválidas" (no revela si el email existe)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      const dto = new LoginUserDTO({ email: 'noexiste@test.com', password: 'password123' });
      await expect(useCase.execute(dto)).rejects.toThrow('Credenciales inválidas');
    });

    test('no llama a compare si el usuario no existe', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      const dto = new LoginUserDTO({ email: 'noexiste@test.com', password: 'password123' });
      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockPasswordHasher.compare).not.toHaveBeenCalled();
    });
  });

  // ── Contraseña incorrecta ──────────────────────────────────────────────────
  describe('contraseña incorrecta', () => {
    test('lanza "Credenciales inválidas" cuando la contraseña no coincide', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(VALID_USER);
      mockPasswordHasher.compare.mockResolvedValue(false);
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'wrongpassword' });
      await expect(useCase.execute(dto)).rejects.toThrow('Credenciales inválidas');
    });

    test('no genera token si la contraseña es incorrecta', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(VALID_USER);
      mockPasswordHasher.compare.mockResolvedValue(false);
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: 'wrongpassword' });
      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockJwtGenerator.generate).not.toHaveBeenCalled();
    });
  });

  // ── Validación del DTO ─────────────────────────────────────────────────────
  describe('validación del DTO', () => {
    test('lanza error si el email está vacío', async () => {
      const dto = new LoginUserDTO({ email: '', password: 'password123' });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si la contraseña está vacía', async () => {
      const dto = new LoginUserDTO({ email: 'cliente@test.com', password: '' });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si ambos campos están vacíos', async () => {
      const dto = new LoginUserDTO({ email: '', password: '' });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('no llama al repositorio si el DTO es inválido', async () => {
      const dto = new LoginUserDTO({ email: '', password: '' });
      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
    });
  });

  // ── Usuario RESTAURANT con restaurantId ────────────────────────────────────
  describe('usuario tipo RESTAURANT', () => {
    test('incluye restaurantId en el payload del JWT cuando corresponde', async () => {
      const restaurantUser = new User({
        id:           'rrrrrrrr-2222-2222-2222-rrrrrrrrrrrr',
        email:        'rest@test.com',
        password:     '$2b$10$hashedpassword',
        firstName:    'Resto',
        lastName:     'Admin',
        role:         UserRole.RESTAURANT,
        restaurantId: '99999999-9999-9999-9999-999999999999'
      });

      mockUserRepo.findByEmail.mockResolvedValue(restaurantUser);
      mockPasswordHasher.compare.mockResolvedValue(true);
      mockJwtGenerator.generate.mockReturnValue('rest.jwt.token');

      const dto = new LoginUserDTO({ email: 'rest@test.com', password: 'password123' });
      await useCase.execute(dto);

      expect(mockJwtGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: '99999999-9999-9999-9999-999999999999'
        })
      );
    });
  });
});
