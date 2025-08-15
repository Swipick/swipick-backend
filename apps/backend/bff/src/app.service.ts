import { Injectable, Logger, HttpException } from '@nestjs/common';
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
    this.gamingServicesUrl = this.configService
      .get<string>('GAMING_SERVICES_URL', '')
      .replace(/\/+$/, '');
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
    const url = `${this.gamingServicesUrl}${path}`;
    this.logger.log(`Forwarding ${method} request to: ${url}`);

    try {
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
      this.logger.log(
        `Gaming Services response ${response.status} for ${method} ${path}`,
      );
      return response.data;
    } catch (err: any) {
      // Axios style error structure handling
      const status = err?.response?.status || 500;
      const upstreamBody = err?.response?.data;
      const upstreamMessage = upstreamBody?.message || err?.message;
      // Capture common root causes (missing migrations, network, etc.)
      if (
        upstreamMessage?.includes('relation') &&
        upstreamMessage?.includes('does not exist')
      ) {
        this.logger.error(
          `Likely missing migration in Gaming Services (table not found). Upstream error: ${upstreamMessage}`,
        );
      } else {
        this.logger.error(
          `Upstream error ${status} for ${method} ${path}: ${upstreamMessage}`,
        );
      }
      if (upstreamBody && typeof upstreamBody === 'object') {
        this.logger.debug(
          `Upstream error payload: ${JSON.stringify(upstreamBody)}`,
        );
      }
      // Re-throw a sanitized HttpException so frontend can surface a clearer message (but not internal stack)
      throw new HttpException(
        {
          success: false,
          proxied: true,
          path,
          upstreamStatus: status,
          message: upstreamMessage || 'Upstream service error',
        },
        status,
      );
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
