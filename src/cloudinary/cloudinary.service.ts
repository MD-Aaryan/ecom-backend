import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CLOUDINARY } from './cloudinary.provider';
import { UploadedFile } from '../common/types/uploaded-file.type';

interface CloudinaryInstance {
  uploader: {
    upload_stream(
      options: { folder: string },
      callback: (err: Error | null, result: CloudinaryResult) => void,
    ): { end(buffer: Buffer): void };
    destroy(publicId: string): Promise<unknown>;
  };
}

interface CloudinaryResult {
  secure_url?: string;
  public_id?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Inject(CLOUDINARY) private cloudinary: CloudinaryInstance) {}

  async uploadFile(file: UploadedFile, folder?: string) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP files are allowed',
      );
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File size must be less than 5MB');

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
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
    await this.cloudinary.uploader.destroy(publicId);
  }
}
