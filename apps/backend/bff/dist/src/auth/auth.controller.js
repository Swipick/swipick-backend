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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const common_2 = require("@swipick/common");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async verifyToken(verifyTokenDto) {
        if (!verifyTokenDto.token) {
            throw new common_1.BadRequestException('Token is required');
        }
        try {
            const user = await this.authService.verifyToken(verifyTokenDto.token);
            return {
                success: true,
                user,
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    async verifyFromHeader(authorization) {
        if (!authorization) {
            throw new common_1.UnauthorizedException('Authorization header required');
        }
        const token = authorization.replace('Bearer ', '');
        try {
            const user = await this.authService.verifyToken(token);
            return {
                success: true,
                user,
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('verify-token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof common_2.VerifyTokenDto !== "undefined" && common_2.VerifyTokenDto) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyToken", null);
__decorate([
    (0, common_1.Post)('verify-header'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyFromHeader", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [typeof (_a = typeof auth_service_1.AuthService !== "undefined" && auth_service_1.AuthService) === "function" ? _a : Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map