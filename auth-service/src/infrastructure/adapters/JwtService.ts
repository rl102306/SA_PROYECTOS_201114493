import jwt from 'jsonwebtoken';
import { IJwtGenerator, JwtPayload } from '../../domain/interfaces/IJwtGenerator';

export class JwtService implements IJwtGenerator {
  private secret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'default-secret-key';
  }

  generate(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: '24h' });
  }

  verify(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }
}