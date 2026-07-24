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
  Req,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
      +id,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewService.create(req.user.userId, +id, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewService.update(req.user.userId, +id, dto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Req() req: any) {
    return this.reviewService.delete(req.user.userId, +id, req.user.role);
  }
}
