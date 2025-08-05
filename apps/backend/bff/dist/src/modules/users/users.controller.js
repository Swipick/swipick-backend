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
var UsersController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const dto_1 = require("./dto");
let UsersController = UsersController_1 = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
        this.logger = new common_1.Logger(UsersController_1.name);
    }
    async register(createUserDto) {
        this.logger.log(`Traditional registration attempt for email: ${createUserDto.email}`);
        const user = await this.usersService.createUser(createUserDto);
        return {
            success: true,
            data: user,
            message: 'Utente registrato con successo',
        };
    }
    async syncGoogle(googleSyncDto) {
        this.logger.log('Google OAuth sync attempt');
        const user = await this.usersService.syncGoogleUser(googleSyncDto);
        return {
            success: true,
            data: user,
            message: user.needsProfileCompletion
                ? 'Utente sincronizzato. Completa il profilo per continuare.'
                : 'Accesso effettuato con successo',
        };
    }
    async completeProfile(userId, completeProfileDto) {
        this.logger.log(`Profile completion attempt for user: ${userId}`);
        const user = await this.usersService.completeProfile(userId, completeProfileDto);
        return {
            success: true,
            data: user,
            message: 'Profilo completato con successo',
        };
    }
    async getUserProfile(userId) {
        this.logger.log(`Get profile request for user: ${userId}`);
        const user = await this.usersService.getUserById(userId);
        return {
            success: true,
            data: user,
        };
    }
    async getUserProfileByFirebaseUid(firebaseUid) {
        this.logger.log(`Get profile request for Firebase UID: ${firebaseUid}`);
        const user = await this.usersService.getUserByFirebaseUid(firebaseUid);
        return {
            success: true,
            data: user,
        };
    }
    async health() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'users-service',
        };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('sync-google'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.GoogleSyncUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "syncGoogle", null);
__decorate([
    (0, common_1.Post)('complete-profile/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CompleteProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "completeProfile", null);
__decorate([
    (0, common_1.Get)('profile/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserProfile", null);
__decorate([
    (0, common_1.Get)('profile/firebase/:uid'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('uid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUserProfileByFirebaseUid", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "health", null);
exports.UsersController = UsersController = UsersController_1 = __decorate([
    (0, common_1.Controller)('api/users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map