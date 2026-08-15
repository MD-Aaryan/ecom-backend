import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadedFile } from '../common/types/uploaded-file.type';

interface CloudinaryResult {
  secure_url?: string;
  public_id?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(file: UploadedFile, folder?: string) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP files are allowed',
      );
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File size must be less than 5MB');
    if (!this.hasValidSignature(file.buffer, file.mimetype))
      throw new BadRequestException('File content does not match its type');

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: folder ?? 'ecommerce' },
        (err, result) => {
          if (err) {
            this.logger.error(`Cloudinary upload failed: ${err.message}`);
            return reject(new BadRequestException('Upload failed'));
          }
          resolve({
            url: result?.secure_url ?? '',
            publicId: result?.public_id ?? '',
          });
        },
      );
      upload.end(file.buffer);
    });
  }

  async deleteFile(publicId: string) {
    await cloudinary.uploader.destroy(publicId);
  }

  private hasValidSignature(buffer: Buffer, mimetype: string): boolean {
    const bytes = (n: number) => Array.from(buffer.subarray(0, n));
    if (mimetype === 'image/jpeg') {
      return (
        buffer.length > 3 &&
        bytes(3).join(',') === [0xff, 0xd8, 0xff].join(',')
      );
    }
    if (mimetype === 'image/png') {
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return (
        buffer.length >= sig.length &&
        bytes(sig.length).join(',') === sig.join(',')
      );
    }
    if (mimetype === 'image/webp') {
      const riff = buffer.toString('latin1', 0, 4) === 'RIFF';
      const webp = buffer.toString('latin1', 8, 12) === 'WEBP';
      return buffer.length > 12 && riff && webp;
    }
    return false;
  }
}
