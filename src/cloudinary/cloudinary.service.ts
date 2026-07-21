import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { CLOUDINARY } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Inject(CLOUDINARY) private cloudinary: any) {}

  async uploadFile(file: any, folder?: string) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, and WebP files are allowed');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File size must be less than 5MB');

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        { folder: folder ?? 'ecommerce' },
        (err: any, result: any) => {
          if (err) {
            this.logger.error(`Cloudinary upload failed: ${err.message}`);
            return reject(new BadRequestException('Upload failed'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      upload.end(file.buffer);
    });
  }

  async deleteFile(publicId: string) {
    await this.cloudinary.uploader.destroy(publicId);
  }
}
