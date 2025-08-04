import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly gamingServicesUrl: string;
  private readonly gamingServicesHealthUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.gamingServicesUrl = this.configService.get<string>(
      'GAMING_SERVICES_URL',
      '',
    );
    this.gamingServicesHealthUrl = this.configService.get<string>(
      'GAMING_SERVICES_HEALTH_URL',
      '',
    );

    this.logger.log(`Gaming Services URL: ${this.gamingServicesUrl}`);
    this.logger.log(
      `Gaming Services Health URL: ${this.gamingServicesHealthUrl}`,
    );
  }

  getHello(): string {
    return 'Hello World!';
  }

  async forwardToGamingServices(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
  ): Promise<any> {
    try {
      const url = `${this.gamingServicesUrl}${path}`;
      this.logger.log(`Forwarding ${method} request to: ${url}`);

      let response: AxiosResponse;

      switch (method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url));
          break;
        case 'POST':
          response = await firstValueFrom(this.httpService.post(url, data));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, data));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url));
          break;
        default:
          response = await firstValueFrom(this.httpService.get(url));
      }

      this.logger.log(`Gaming Services response status: ${response.status}`);
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error forwarding to Gaming Services: ${errorMessage}`);
      throw error;
    }
  }

  async checkGamingServicesHealth(): Promise<any> {
    try {
      this.logger.log('Checking Gaming Services health...');
      const response = await firstValueFrom(
        this.httpService.get(this.gamingServicesHealthUrl),
      );
      this.logger.log('Gaming Services health check successful');
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Gaming Services health check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
