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
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.AuthProvider = void 0;
const typeorm_1 = require("typeorm");
var AuthProvider;
(function (AuthProvider) {
    AuthProvider["EMAIL"] = "email";
    AuthProvider["GOOGLE"] = "google";
})(AuthProvider || (exports.AuthProvider = AuthProvider = {}));
let User = class User {
    isGoogleUser() {
        return this.authProvider === AuthProvider.GOOGLE;
    }
    isEmailUser() {
        return this.authProvider === AuthProvider.EMAIL;
    }
    needsProfileCompletion() {
        return this.isGoogleUser() && !this.profileCompleted;
    }
    getDisplayName() {
        return this.nickname || this.name;
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 128, name: 'firebase_uid' }),
    __metadata("design:type", String)
], User.prototype, "firebaseUid", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 255 }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        nullable: true,
        unique: true,
        comment: "Nullable for Google users who haven't completed profile",
    }),
    __metadata("design:type", Object)
], User.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        nullable: true,
        length: 255,
        name: 'password_hash',
        comment: 'Null for Google OAuth users',
    }),
    __metadata("design:type", Object)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AuthProvider,
        default: AuthProvider.EMAIL,
        name: 'auth_provider',
    }),
    __metadata("design:type", String)
], User.prototype, "authProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({
        nullable: true,
        type: 'text',
        name: 'google_profile_url',
        comment: 'Google profile picture URL',
    }),
    __metadata("design:type", Object)
], User.prototype, "googleProfileUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true, name: 'is_active' }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false, name: 'email_verified' }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({
        default: false,
        name: 'profile_completed',
        comment: 'Track if Google users completed profile setup',
    }),
    __metadata("design:type", Boolean)
], User.prototype, "profileCompleted", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users'),
    (0, typeorm_1.Index)(['firebaseUid'], { unique: true }),
    (0, typeorm_1.Index)(['email'], { unique: true }),
    (0, typeorm_1.Index)(['nickname'], { unique: true, where: 'nickname IS NOT NULL' }),
    (0, typeorm_1.Index)(['authProvider'])
], User);
//# sourceMappingURL=user.entity.js.map