import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'Welcome to Rukny.io API',
      version: '1.0',
      docs: '/api/docs',
      endpoints: {
        health: '/api/v1/health',
        swagger: '/api/docs',
      },
    };
  }
}
