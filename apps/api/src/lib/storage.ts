import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Document storage. Keys are generated server-side (`<ownerId>/<uuid>`), never derived from user input, and never
 * exposed to clients. STORAGE_DRIVER=local writes to disk (dev, or a persistent volume); STORAGE_DRIVER=s3 uses any
 * S3-compatible object store. Enable bucket-level encryption and keep the bucket private: the API is the only reader.
 */
export interface Storage {
  put(ownerId: string, data: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

function localDriver(): Storage {
  const root = path.resolve(env.UPLOAD_DIR);
  const full = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return p;
  };
  return {
    async put(ownerId, data) {
      const key = `${ownerId}/${randomUUID()}`;
      await mkdir(path.dirname(full(key)), { recursive: true });
      await writeFile(full(key), data, { flag: 'wx' });
      return key;
    },
    get: (key) => readFile(full(key)),
    async remove(key) {
      try { await unlink(full(key)); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    },
  };
}

function s3Driver(): Storage {
  const bucket = env.OBJECT_STORAGE_BUCKET!;
  // Loaded lazily so local development and tests never need the AWS SDK at runtime.
  let sdk: Promise<{ m: typeof import('@aws-sdk/client-s3'); client: import('@aws-sdk/client-s3').S3Client }> | null = null;
  const load = () => (sdk ??= import('@aws-sdk/client-s3').then((m) => ({
    m,
    client: new m.S3Client({
      region: env.OBJECT_STORAGE_REGION, endpoint: env.OBJECT_STORAGE_ENDPOINT, forcePathStyle: Boolean(env.OBJECT_STORAGE_ENDPOINT),
      credentials: { accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID!, secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY! },
    }),
  })));
  return {
    async put(ownerId, data) {
      const { m, client } = await load(); const key = `${ownerId}/${randomUUID()}`;
      await client.send(new m.PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
      return key;
    },
    async get(key) {
      const { m, client } = await load();
      const out = await client.send(new m.GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await out.Body!.transformToByteArray());
    },
    async remove(key) {
      const { m, client } = await load();
      await client.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: key })); // S3 delete is idempotent
    },
  };
}

export const storage: Storage = env.STORAGE_DRIVER === 's3' ? s3Driver() : localDriver();
