"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let AppService = AppService_1 = class AppService {
    constructor(configService, httpService) {
        this.configService = configService;
        this.httpService = httpService;
        this.logger = new common_1.Logger(AppService_1.name);
        this.gamingServicesUrl = this.configService.get('GAMING_SERVICES_URL', '');
        this.gamingServicesHealthUrl = this.configService.get('GAMING_SERVICES_HEALTH_URL', '');
        this.logger.log(`Gaming Services URL: ${this.gamingServicesUrl}`);
        this.logger.log(`Gaming Services Health URL: ${this.gamingServicesHealthUrl}`);
    }
    getHello() {
        return 'Hello World!';
    }
    async forwardToGamingServices(path, method = 'GET', data) {
        try {
            const url = `${this.gamingServicesUrl}${path}`;
            this.logger.log(`Forwarding ${method} request to: ${url}`);
            let response;
            switch (method) {
                case 'GET':
                    response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url));
                    break;
                case 'POST':
                    response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, data));
                    break;
                case 'PUT':
                    response = await (0, rxjs_1.firstValueFrom)(this.httpService.put(url, data));
                    break;
                case 'DELETE':
                    response = await (0, rxjs_1.firstValueFrom)(this.httpService.delete(url));
                    break;
                default:
                    response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url));
            }
            this.logger.log(`Gaming Services response status: ${response.status}`);
            return response.data;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error forwarding to Gaming Services: ${errorMessage}`);
            throw error;
        }
    }
    async checkGamingServicesHealth() {
        try {
            this.logger.log('Checking Gaming Services health...');
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(this.gamingServicesHealthUrl));
            this.logger.log('Gaming Services health check successful');
            return response.data;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Gaming Services health check failed: ${errorMessage}`);
            return {
                status: 'unhealthy',
                error: errorMessage,
                timestamp: new Date().toISOString(),
            };
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = AppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService])
], AppService);
//# sourceMappingURL=app.service.js.map