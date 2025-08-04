import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('BFF Application (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

  describe('Authentication Endpoints', () => {
    it('/auth/verify-token (POST) should verify token', () => {
      return request(app.getHttpServer())
        .post('/auth/verify-token')
        .send({ token: 'test-token' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('id', 'mock-user-id');
        });
    });

    it('/auth/verify-token (POST) should handle missing token', () => {
      return request(app.getHttpServer())
        .post('/auth/verify-token')
        .send({})
        .expect(400); // Bad request due to validation
    });

    it('/auth/verify-header (POST) should verify authorization header', () => {
      return request(app.getHttpServer())
        .post('/auth/verify-header')
        .set('Authorization', 'Bearer test-token')
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('id', 'mock-user-id');
        });
    });

    it('/auth/verify-header (POST) should reject missing authorization header', () => {
      return request(app.getHttpServer())
        .post('/auth/verify-header')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'Authorization header required',
          );
        });
    });
  });

  describe('API Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer()).get('/non-existent').expect(404);
    });

    it('should handle CORS preflight requests', () => {
      return request(app.getHttpServer())
        .options('/auth/verify-token')
        .expect(204);
    });
  });
});
