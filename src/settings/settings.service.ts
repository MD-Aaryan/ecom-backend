import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadedFile } from '../common/types/uploaded-file.type';
import { UpdateShippingDto } from './dto/update-shipping.dto';

interface StoredHeroImage {
  url: string;
  publicId: string;
}

const SITE_ID = 'site';
const HERO_SLOTS = 3;

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  private async getOrCreate() {
    const existing = await this.prisma.siteSetting.findUnique({
      where: { id: SITE_ID },
    });
    if (existing) return existing;
    return this.prisma.siteSetting.create({
      data: { id: SITE_ID },
    });
  }

  async getPublic() {
    const setting = await this.getOrCreate();
    const heroImages = (
      (setting.heroImages as unknown as StoredHeroImage[]) ?? []
    ).map((h) => h.url);
    while (heroImages.length < HERO_SLOTS) heroImages.push('https://via.placeholder.com/600');
    return {
      heroImages,
      freeShippingThreshold: setting.freeShippingThreshold,
      standardShippingFee: setting.standardShippingFee,
    };
  }

  async getShipping() {
    const setting = await this.getOrCreate();
    return {
      freeShippingThreshold: setting.freeShippingThreshold,
      standardShippingFee: setting.standardShippingFee,
    };
  }

  async updateShipping(dto: UpdateShippingDto) {
    await this.prisma.siteSetting.update({
      where: { id: SITE_ID },
      data: {
        freeShippingThreshold: dto.freeShippingThreshold,
        standardShippingFee: dto.standardShippingFee,
      },
    });
    return this.getPublic();
  }

  async uploadHeroImage(slot: number, file?: UploadedFile) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    if (slot < 0 || slot >= HERO_SLOTS) {
      throw new BadRequestException(`Slot must be between 0 and ${HERO_SLOTS - 1}`);
    }
    const setting = await this.getOrCreate();
    const existing = (
      (setting.heroImages as unknown as StoredHeroImage[]) ?? []
    ).slice();
    const { url, publicId } = await this.cloudinary.uploadFile(file, 'heroes');
    const old = existing[slot];
    if (old?.publicId) {
      try {
        await this.cloudinary.deleteFile(old.publicId);
      } catch {
        // continue with the swap even if cloudinary cleanup fails
      }
    }
    existing[slot] = { url, publicId };
    await this.prisma.siteSetting.update({
      where: { id: SITE_ID },
      data: { heroImages: existing as unknown as Prisma.InputJsonValue },
    });
    return this.getPublic();
  }
}