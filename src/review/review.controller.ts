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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadedFile as MulterFile } from '../common/types/uploaded-file.type';

@Controller()
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  @Get('products/:id/reviews')
  getProductReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewService.getProductReviews(
      id,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  create(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.reviewService.create(userId, id, dto, file);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser('userId') userId: string,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.reviewService.update(userId, id, dto, file);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  delete(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.reviewService.delete(userId, id, role);
  }
}
