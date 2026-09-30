import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Types } from 'mongoose';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function signToken(payload: { userId: Types.ObjectId; email: string; role: string }): string {
  const tokenPayload = {
    userId: payload.userId.toString(),
    email: payload.email,
    role: payload.role,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = { expiresIn: env.JWT_EXPIRES_IN };
  return jwt.sign(tokenPayload, env.JWT_SECRET as jwt.Secret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET as jwt.Secret) as JwtPayload;
}
