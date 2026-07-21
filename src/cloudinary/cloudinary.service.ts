import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { CLOUDINARY } from './cloudinary.provider';
import { validateFile } from '../common/helpers/file.helper';

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private cloudinary: any) {}

  async uploadFile(file: any, folder?: string) {
    const validation = validateFile(file.mimetype, file.size);
    if (!validation.valid) throw new BadRequestException(validation.error);

    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        { folder: folder ?? 'ecommerce' },
        (err: any, result: any) => {
          if (err) return reject(new BadRequestException('Upload failed'));
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
