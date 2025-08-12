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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AppController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
let AppController = AppController_1 = class AppController {
    constructor(appService) {
        this.appService = appService;
        this.logger = new common_1.Logger(AppController_1.name);
    }
    getHello() {
        return this.appService.getHello();
    }
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'swipick-bff',
        };
    }
    async getFullHealth() {
        const bffHealth = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'swipick-bff',
        };
        const gamingServicesHealth = await this.appService.checkGamingServicesHealth();
        return {
            bff: bffHealth,
            gamingServices: gamingServicesHealth,
            overall: {
                status: gamingServicesHealth.status === 'ok' ? 'ok' : 'degraded',
                timestamp: new Date().toISOString(),
            },
        };
    }
    async getFixtures() {
        this.logger.log('Forwarding fixtures request to Gaming Services');
        return this.appService.forwardToGamingServices('/api/fixtures');
    }
    async getLiveFixtures() {
        this.logger.log('Forwarding live fixtures request to Gaming Services');
        return this.appService.forwardToGamingServices('/api/fixtures/live');
    }
    async getUpcomingSerieAFixtures(req) {
        this.logger.log('Forwarding Serie A fixtures request to Gaming Services');
        const queryString = req.url.split('?')[1] || '';
        const endpoint = `/api/fixtures/upcoming/serie-a${queryString ? `?${queryString}` : ''}`;
        return this.appService.forwardToGamingServices(endpoint);
    }
    async getFixtureById(id) {
        this.logger.log(`Forwarding fixture ${id} request to Gaming Services`);
        return this.appService.forwardToGamingServices(`/api/fixtures/${id}`);
    }
    async syncFixtures(body) {
        this.logger.log('Forwarding fixtures sync request to Gaming Services');
        return this.appService.forwardToGamingServices('/api/fixtures/sync', 'POST', body);
    }
    async getTeams() {
        this.logger.log('Forwarding teams request to Gaming Services');
        return this.appService.forwardToGamingServices('/api/teams');
    }
    async getTeamById(id) {
        this.logger.log(`Forwarding team ${id} request to Gaming Services`);
        return this.appService.forwardToGamingServices(`/api/teams/${id}`);
    }
    async getTeamStatistics(id) {
        this.logger.log(`Forwarding team ${id} statistics request to Gaming Services`);
        return this.appService.forwardToGamingServices(`/api/teams/${id}/statistics`);
    }
    async getTeamVsTeam(id1, id2) {
        this.logger.log(`Forwarding team ${id1} vs ${id2} request to Gaming Services`);
        return this.appService.forwardToGamingServices(`/api/teams/${id1}/vs/${id2}`);
    }
    async getGamingServicesHealth() {
        this.logger.log('Forwarding health check to Gaming Services');
        return this.appService.forwardToGamingServices('/api/health');
    }
    async createPrediction(dto) {
        this.logger.log(`Creating ${dto.mode} prediction: User ${dto.userId}, Fixture ${dto.fixtureId}, Choice: ${dto.choice}`);
        const { userId, mode, fixtureId, choice } = dto;
        if (mode === 'test') {
            return this.appService.forwardToGamingServices('/api/test-mode/predictions', 'POST', { userId, fixtureId, choice });
        }
        else {
            return this.appService.forwardToGamingServices('/api/predictions', 'POST', { userId, fixtureId, choice });
        }
    }
    async getUserWeeklyPredictions(userId, week, query) {
        const mode = query.mode || 'live';
        this.logger.log(`Getting ${mode} weekly predictions: User ${userId}, Week ${week}`);
        if (mode === 'test') {
            return this.appService.forwardToGamingServices(`/api/test-mode/predictions/user/${userId}/week/${week}`);
        }
        else {
            return this.appService.forwardToGamingServices(`/api/predictions/user/${userId}/week/${week}`);
        }
    }
    async getUserSummary(userId, query) {
        const mode = query.mode || 'live';
        this.logger.log(`Getting ${mode} user summary: User ${userId}`);
        if (mode === 'test') {
            return this.appService.forwardToGamingServices(`/api/test-mode/predictions/user/${userId}/summary`);
        }
        else {
            return this.appService.forwardToGamingServices(`/api/predictions/user/${userId}/summary`);
        }
    }
    async resetTestData(userId) {
        this.logger.log(`Resetting test data for user ${userId}`);
        return this.appService.forwardToGamingServices(`/api/test-mode/reset/${userId}`, 'DELETE');
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('health/full'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getFullHealth", null);
__decorate([
    (0, common_1.Get)('api/fixtures'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getFixtures", null);
__decorate([
    (0, common_1.Get)('api/fixtures/live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getLiveFixtures", null);
__decorate([
    (0, common_1.Get)('api/fixtures/upcoming/serie-a'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getUpcomingSerieAFixtures", null);
__decorate([
    (0, common_1.Get)('api/fixtures/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getFixtureById", null);
__decorate([
    (0, common_1.Post)('api/fixtures/sync'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "syncFixtures", null);
__decorate([
    (0, common_1.Get)('api/teams'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getTeams", null);
__decorate([
    (0, common_1.Get)('api/teams/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getTeamById", null);
__decorate([
    (0, common_1.Get)('api/teams/:id/statistics'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getTeamStatistics", null);
__decorate([
    (0, common_1.Get)('api/teams/:id1/vs/:id2'),
    __param(0, (0, common_1.Param)('id1')),
    __param(1, (0, common_1.Param)('id2')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getTeamVsTeam", null);
__decorate([
    (0, common_1.Get)('api/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getGamingServicesHealth", null);
__decorate([
    (0, common_1.Post)('api/predictions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "createPrediction", null);
__decorate([
    (0, common_1.Get)('api/predictions/user/:userId/week/:week'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('week')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getUserWeeklyPredictions", null);
__decorate([
    (0, common_1.Get)('api/predictions/user/:userId/summary'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getUserSummary", null);
__decorate([
    (0, common_1.Delete)('api/test-mode/reset/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "resetTestData", null);
exports.AppController = AppController = AppController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService])
], AppController);
//# sourceMappingURL=app.controller.js.map