"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const request = require("supertest");
const app_module_1 = require("./../src/app.module");
describe('BFF Application (e2e)', () => {
    let app;
    beforeEach(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();
    });
    afterEach(async () => {
        await app.close();
    });
    describe('Health Check', () => {
        it('/ (GET) should return Hello World!', () => {
            return request(app.getHttpServer())
                .get('/')
                .expect(200)
                .expect('Hello World!');
        });
    });
    describe('API Error Handling', () => {
        it('should return 404 for non-existent endpoints', () => {
            return request(app.getHttpServer()).get('/non-existent').expect(404);
        });
    });
});
//# sourceMappingURL=app.e2e-spec.js.map