import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
export declare class AppService {
    private readonly configService;
    private readonly httpService;
    private readonly logger;
    private readonly gamingServicesUrl;
    private readonly gamingServicesHealthUrl;
    constructor(configService: ConfigService, httpService: HttpService);
    getHello(): string;
    forwardToGamingServices(path: string, method?: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any): Promise<any>;
    checkGamingServicesHealth(): Promise<any>;
}
