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
    const defaultOrigins = [
        'https://swipick-production.up.railway.app',
        'https://frontend-service-production.up.railway.app',
        'http://localhost:3000',
        'http://localhost:3001',
    ];
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
        : defaultOrigins;
    console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`🔧 Allowed CORS origins:`, allowedOrigins);
    const corsConfig = {
        origin: allowedOrigins,
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
    };
    console.log(`🚀 CORS Configuration Applied:`, JSON.stringify(corsConfig, null, 2));
    app.enableCors(corsConfig);
    app.use((req, res, next) => {
        if (req.method === 'OPTIONS') {
            console.log(`🔍 CORS Preflight Request:`, {
                method: req.method,
                origin: req.headers.origin,
                headers: req.headers,
                url: req.url,
            });
        }
        next();
    });
    const port = process.env.PORT || 9000;
    await app.listen(port);
    console.log(`🚀 BFF Service is running on: http://localhost:${port}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
//# sourceMappingURL=main.js.map