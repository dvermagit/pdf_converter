import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'client';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return password hash by default
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'client'],
      default: 'client',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const { passwordHash: _pw, __v: _v, ...rest } = ret;
        return rest;
      },
    },
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
