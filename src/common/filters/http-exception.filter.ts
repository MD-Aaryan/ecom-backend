import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof httpBody === 'string'
        ? httpBody
        : ((httpBody as { message?: unknown })?.message ??
          'Internal server error');

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url} → 500: ${
          exception instanceof Error
            ? (exception.stack ?? exception.message)
            : String(exception)
        }`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
