import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseInterceptors,
  UseGuards,
  ParseIntPipe,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UploadedFile as UploadedFileType } from '../common/types/uploaded-file.type';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getPublic() {
    return this.settingsService.getPublic();
  }

  @Get('shipping')
  getShipping() {
    return this.settingsService.getShipping();
  }

  @Patch('shipping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateShipping(@Body() dto: UpdateShippingDto) {
    return this.settingsService.updateShipping(dto);
  }

  @Post('hero/:slot')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadHeroImage(
    @Param('slot', ParseIntPipe) slot: number,
    @UploadedFile() file?: UploadedFileType,
  ) {
    return this.settingsService.uploadHeroImage(slot, file);
  }
}