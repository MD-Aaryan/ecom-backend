import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getBasic() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
