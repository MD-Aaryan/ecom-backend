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
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class ReturnController {
  constructor(private returnService: ReturnService) {}

  @Post('orders/:id/return')
  @UseGuards(JwtAuthGuard)
  requestReturn(
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.returnService.requestReturn(id, userId, dto);
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
