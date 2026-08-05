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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
  create(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reviewService.create(userId, id, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reviewService.update(userId, id, dto);
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
