import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { NotificationService } from '../notifications/notification.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
  ) {}

  @Get('me/notifications')
  @UseGuards(JwtAuthGuard)
  getNotifications(@CurrentUser('userId') userId: string) {
    return this.notificationService.getUserNotifications(userId);
  }

  @Patch('me/notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  markNotificationRead(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationService.markRead(id, userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser('userId') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.userService.listUsers(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.userService.updateRole(id, dto.role, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  softDeleteUser(@Param('id') id: string, @CurrentUser('userId') adminId: string) {
    return this.userService.softDeleteUser(id, adminId);
  }

  @Delete(':id/hard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  hardDeleteUser(@Param('id') id: string, @CurrentUser('userId') adminId: string) {
    return this.userService.hardDeleteUser(id, adminId);
  }
}
