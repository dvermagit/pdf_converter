import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Abstract storage interface for local dev and S3 production
interface StorageProvider {
  save(filePath: string, destination: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalStorage implements StorageProvider {
  async save(filePath: string, destination: string): Promise<string> {
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (filePath !== destination) {
      fs.copyFileSync(filePath, destination);
    }

    return destination;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFileSync(key);
  }

  async delete(key: string): Promise<void> {
    if (fs.existsSync(key)) {
      fs.unlinkSync(key);
      logger.debug({ key }, 'File deleted');
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(key);
  }
}

// S3 placeholder — implement with AWS SDK when needed
class S3Storage implements StorageProvider {
  async save(_filePath: string, _destination: string): Promise<string> {
    throw new Error('S3 storage not yet implemented. Set STORAGE_DRIVER=local for development.');
  }

  async read(_key: string): Promise<Buffer> {
    throw new Error('S3 storage not yet implemented.');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('S3 storage not yet implemented.');
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error('S3 storage not yet implemented.');
  }
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!provider) {
    provider = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
    logger.info({ driver: env.STORAGE_DRIVER }, 'Storage provider initialized');
  }
  return provider;
}

// Utility paths
export function getUploadsDir(): string {
  const dir = path.resolve('uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getGeneratedDir(): string {
  const dir = path.resolve('generated');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
