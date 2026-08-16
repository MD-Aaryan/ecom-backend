import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadedFile as MulterFile } from '../common/types/uploaded-file.type';

@Controller()
export class ReturnController {
  constructor(private returnService: ReturnService) {}

  @Get('orders/returnable')
  @UseGuards(JwtAuthGuard)
  getReturnableOrders(@CurrentUser('userId') userId: string) {
    return this.returnService.getReturnableOrders(userId);
  }

  @Post('orders/:id/return')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  requestReturn(
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.returnService.requestReturn(id, userId, dto, file);
  }

  @Get('returns')
  @UseGuards(JwtAuthGuard)
  getUserReturns(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.returnService.getUserReturns(
      userId,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Get('returns/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllReturns(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.returnService.getAllReturns(
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Patch('returns/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto) {
    return this.returnService.updateReturnStatus(id, dto);
  }

  @Delete('returns/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.returnService.remove(id);
  }
}
