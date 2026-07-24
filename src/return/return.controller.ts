import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller()
export class ReturnController {
  constructor(private returnService: ReturnService) {}

  @Post('orders/:id/return')
  @UseGuards(JwtAuthGuard)
  requestReturn(
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
    @Req() req: any,
  ) {
    return this.returnService.requestReturn(+id, req.user.userId, dto);
  }

  @Get('returns')
  @UseGuards(JwtAuthGuard)
  getUserReturns(@Req() req: any) {
    return this.returnService.getUserReturns(req.user.userId);
  }

  @Get('returns/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllReturns() {
    return this.returnService.getAllReturns();
  }

  @Patch('returns/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto) {
    return this.returnService.updateReturnStatus(+id, dto);
  }
}
