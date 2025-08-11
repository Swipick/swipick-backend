"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const allowedOrigins = [
        'https://swipick-production.up.railway.app',
        'https://frontend-service-production.up.railway.app',
        'http://localhost:3000',
        'http://localhost:3001',
    ];
    console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`🔧 Allowed CORS origins:`, allowedOrigins);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            console.log(`❌ CORS blocked origin: ${origin}`);
            return callback(new Error(`CORS policy violation: ${origin} not allowed`), false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
        ],
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });
    const port = process.env.PORT || 9000;
    await app.listen(port);
    console.log(`🚀 BFF Service is running on: http://localhost:${port}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
//# sourceMappingURL=main.js.map