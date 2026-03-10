import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Returns welcome message',
    schema: {
      example: {
        message: 'Welcome to Rukny.io API',
        version: '1.0',
        docs: '/api/docs',
        endpoints: {
          health: '/api/v1/health',
          swagger: '/api/docs',
        },
      },
    },
  })
  getHello() {
    return this.appService.getHello();
  }
}
