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
var DatabaseConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const user_entity_1 = require("../entities/user.entity");
let DatabaseConfigService = DatabaseConfigService_1 = class DatabaseConfigService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(DatabaseConfigService_1.name);
    }
    createTypeOrmOptions() {
        const host = this.configService.get('NEON_DB_HOST');
        const username = this.configService.get('NEON_DB_USERNAME');
        const password = this.configService.get('NEON_DB_PASSWORD');
        const database = this.configService.get('NEON_DB_NAME');
        if (!host || !username || !password || !database) {
            this.logger.error('Database configuration is required. Please set NEON_DB_HOST, NEON_DB_USERNAME, NEON_DB_PASSWORD, and NEON_DB_NAME environment variables.');
            throw new Error('Database configuration missing');
        }
        this.logger.log(`Connecting to Neon PostgreSQL: ${username}@${host}/${database}`);
        return {
            type: 'postgres',
            host,
            port: this.configService.get('NEON_DB_PORT', 5432),
            username,
            password,
            database,
            ssl: {
                rejectUnauthorized: false,
            },
            entities: [user_entity_1.User],
            synchronize: this.configService.get('NODE_ENV') !== 'production',
            logging: this.configService.get('NODE_ENV') === 'development',
            migrations: ['dist/migrations/*.js'],
            migrationsTableName: 'migrations',
            retryAttempts: 5,
            retryDelay: 3000,
            autoLoadEntities: true,
            extra: {
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000,
            },
        };
    }
};
exports.DatabaseConfigService = DatabaseConfigService;
exports.DatabaseConfigService = DatabaseConfigService = DatabaseConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseConfigService);
//# sourceMappingURL=database.config.js.map