export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  restaurantId?: string;
}

export interface IJwtGenerator {
  generate(payload: JwtPayload): string;
  verify(token: string): JwtPayload | null;
}
