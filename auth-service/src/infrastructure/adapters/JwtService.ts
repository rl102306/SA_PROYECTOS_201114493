import jwt, { SignOptions } from "jsonwebtoken";
import { IJwtGenerator, JwtPayload } from '../../domain/interfaces/IJwtGenerator';

export class JwtService implements IJwtGenerator {
  private readonly secret: string;
  private readonly expiresIn: SignOptions["expiresIn"];

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.expiresIn =
      (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "24h";
  }

  generate(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: this.expiresIn,
    };

    return jwt.sign(payload, this.secret,options);
  }

  verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch (error) {
      return null;
    }
  }
}
