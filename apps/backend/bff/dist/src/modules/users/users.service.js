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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("../../entities/user.entity");
const firebase_config_1 = require("../../config/firebase.config");
const email_service_1 = require("../../services/email.service");
const dto_1 = require("./dto");
const class_transformer_1 = require("class-transformer");
let UsersService = UsersService_1 = class UsersService {
    constructor(userRepository, dataSource, firebaseConfig, emailService) {
        this.userRepository = userRepository;
        this.dataSource = dataSource;
        this.firebaseConfig = firebaseConfig;
        this.emailService = emailService;
        this.logger = new common_1.Logger(UsersService_1.name);
        this.saltRounds = 12;
        this.logger.log('🔧 UsersService initialized');
        this.logger.log(`📧 EmailService available: ${!!this.emailService}`);
    }
    async createUser(createUserDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.checkEmailUniqueness(createUserDto.email);
            await this.checkNicknameUniqueness(createUserDto.nickname);
            const passwordHash = await this.hashPassword(createUserDto.password);
            const firebaseUser = await this.firebaseConfig.createUser(createUserDto.email, createUserDto.password, createUserDto.name);
            const user = queryRunner.manager.create(user_entity_1.User, {
                firebaseUid: firebaseUser.uid,
                email: createUserDto.email,
                name: createUserDto.name,
                nickname: createUserDto.nickname,
                passwordHash,
                authProvider: user_entity_1.AuthProvider.EMAIL,
                emailVerified: false,
                profileCompleted: true,
            });
            const savedUser = await queryRunner.manager.save(user_entity_1.User, user);
            await queryRunner.commitTransaction();
            this.logger.log('🚀 Starting email verification process...');
            try {
                this.logger.log('📧 Generating Firebase verification link...');
                const verificationLink = await this.firebaseConfig.generateEmailVerificationLink(createUserDto.email);
                this.logger.log(`🔗 Firebase verification link generated: ${verificationLink}`);
                this.logger.log('📤 Calling EmailService.sendVerificationEmail...');
                await this.emailService.sendVerificationEmail(createUserDto.email, createUserDto.name, verificationLink);
                this.logger.log(`✅ Verification email sent successfully to ${createUserDto.email}`);
            }
            catch (emailError) {
                this.logger.error(`❌ Failed to send verification email to ${createUserDto.email}`, emailError);
                this.logger.error('📊 Email error details:', JSON.stringify(emailError, null, 2));
            }
            this.logger.log(`Traditional user created successfully: ${savedUser.id}`);
            return this.transformToResponse(savedUser);
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (createUserDto.email) {
                try {
                    const auth = this.firebaseConfig.getAuth();
                    if (auth) {
                        const firebaseUser = await auth.getUserByEmail(createUserDto.email);
                        await this.firebaseConfig.deleteUser(firebaseUser.uid);
                    }
                }
                catch (cleanupError) {
                    this.logger.error('Failed to cleanup Firebase user after database error', cleanupError);
                }
            }
            this.handleRegistrationError(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async syncGoogleUser(googleSyncDto) {
        try {
            const decodedToken = await this.firebaseConfig.verifyIdToken(googleSyncDto.firebaseIdToken);
            const googleUserData = this.extractGoogleUserData(decodedToken);
            let user = await this.userRepository.findOne({
                where: { firebaseUid: googleUserData.uid },
            });
            if (user) {
                user.updatedAt = new Date();
                await this.userRepository.save(user);
                this.logger.log(`Existing Google user login: ${user.id}`);
            }
            else {
                user = await this.createGoogleUser(googleUserData);
                this.logger.log(`New Google user created: ${user.id}`);
            }
            return this.transformToResponse(user);
        }
        catch (error) {
            this.logger.error('Failed to sync Google user', error);
            throw new common_1.BadRequestException('Errore durante la sincronizzazione con Google');
        }
    }
    async completeProfile(userId, completeProfileDto) {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) {
                throw new common_1.NotFoundException('Utente non trovato');
            }
            if (!user.isGoogleUser()) {
                throw new common_1.BadRequestException('Solo gli utenti Google possono completare il profilo');
            }
            if (user.profileCompleted) {
                throw new common_1.BadRequestException('Il profilo è già stato completato');
            }
            await this.checkNicknameUniqueness(completeProfileDto.nickname);
            user.nickname = completeProfileDto.nickname;
            user.profileCompleted = true;
            const displayName = completeProfileDto.nickname;
            await this.firebaseConfig.updateUserDisplayName(user.firebaseUid, displayName);
            const savedUser = await this.userRepository.save(user);
            this.logger.log(`Google user profile completed: ${savedUser.id}`);
            return this.transformToResponse(savedUser);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException ||
                error instanceof common_1.BadRequestException) {
                throw error;
            }
            this.logger.error('Failed to complete user profile', error);
            throw new common_1.BadRequestException('Errore durante il completamento del profilo');
        }
    }
    async getUserById(id) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Utente non trovato');
        }
        return this.transformToResponse(user);
    }
    async getUserByFirebaseUid(firebaseUid) {
        const user = await this.userRepository.findOne({ where: { firebaseUid } });
        if (!user) {
            throw new common_1.NotFoundException('Utente non trovato');
        }
        return this.transformToResponse(user);
    }
    async createGoogleUser(googleUserData) {
        const user = this.userRepository.create({
            firebaseUid: googleUserData.uid,
            email: googleUserData.email,
            name: googleUserData.name,
            nickname: null,
            passwordHash: null,
            authProvider: user_entity_1.AuthProvider.GOOGLE,
            googleProfileUrl: googleUserData.picture,
            emailVerified: googleUserData.emailVerified,
            profileCompleted: false,
        });
        return await this.userRepository.save(user);
    }
    extractGoogleUserData(decodedToken) {
        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0],
            picture: decodedToken.picture,
            emailVerified: decodedToken.email_verified || false,
        };
    }
    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }
    async checkEmailUniqueness(email) {
        const existingUser = await this.userRepository.findOne({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Un utente con questa email esiste già');
        }
    }
    async checkNicknameUniqueness(nickname) {
        const existingUser = await this.userRepository.findOne({
            where: { nickname },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Questo nickname è già in uso');
        }
    }
    transformToResponse(user) {
        return (0, class_transformer_1.plainToClass)(dto_1.UserResponseDto, user, {
            excludeExtraneousValues: true,
        });
    }
    async sendPasswordReset(email) {
        try {
            const user = await this.userRepository.findOne({ where: { email } });
            if (!user) {
                this.logger.warn(`Password reset attempted for non-existent email: ${email}`);
                return;
            }
            if (user.authProvider === user_entity_1.AuthProvider.GOOGLE) {
                throw new common_1.BadRequestException('Gli utenti Google non possono reimpostare la password. Usa "Accedi con Google".');
            }
            this.logger.log(`Password reset validation passed for user: ${user.id}`);
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            this.logger.error('Failed to validate password reset request', error);
            throw new common_1.BadRequestException('Errore durante la validazione del reset password');
        }
    }
    async syncPasswordReset(firebaseUid) {
        try {
            const user = await this.userRepository.findOne({
                where: { firebaseUid },
            });
            if (!user) {
                throw new common_1.NotFoundException('Utente non trovato');
            }
            if (user.authProvider === user_entity_1.AuthProvider.GOOGLE) {
                throw new common_1.BadRequestException('Gli utenti Google non possono cambiare password');
            }
            user.updatedAt = new Date();
            user.passwordHash = null;
            await this.userRepository.save(user);
            this.logger.log(`Password reset synced for user: ${user.id}`);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException ||
                error instanceof common_1.BadRequestException) {
                throw error;
            }
            this.logger.error('Failed to sync password reset', error);
            throw new common_1.BadRequestException('Errore durante la sincronizzazione del reset password');
        }
    }
    async testEmailSending(email, name) {
        this.logger.log(`🧪 Testing email sending to: ${email}`);
        try {
            const testLink = 'https://swipick-frontend-production.up.railway.app/verify-test';
            await this.emailService.sendVerificationEmail(email, name, testLink);
            this.logger.log(`✅ Test email sent successfully to: ${email}`);
        }
        catch (error) {
            this.logger.error(`❌ Test email failed for: ${email}`, error);
            throw error;
        }
    }
    handleRegistrationError(error) {
        if (error.code === '23505') {
            if (error.constraint?.includes('email')) {
                throw new common_1.ConflictException('Un utente con questa email esiste già');
            }
            if (error.constraint?.includes('nickname')) {
                throw new common_1.ConflictException('Questo nickname è già in uso');
            }
        }
        this.logger.error('Registration error', error);
        throw new common_1.BadRequestException("Errore durante la registrazione dell'utente");
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        firebase_config_1.FirebaseConfigService,
        email_service_1.EmailService])
], UsersService);
//# sourceMappingURL=users.service.js.map