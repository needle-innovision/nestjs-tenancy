import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Bird Without Tenancy', () => {
    let server: Server;
    let app: INestApplication;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        server = app.getHttpServer();
        await app.init();
    });

    it(`should return created document`, (done) => {
        const dto = { name: 'Pigeon', breed: 'Columbidae', age: 15 };
        request(server)
            .post('/birds')
            .send(dto)
            .expect(201)
            .end((err, { body }) => {
                expect(body.name).toEqual(dto.name);
                expect(body.age).toEqual(dto.age);
                expect(body.breed).toEqual(dto.breed);
                done();
            });
    });

    it(`should return list of birds`, (done) => {
        const dto = { name: 'Pigeon', breed: 'Columbidae', age: 15 };

        request(server)
            .get('/birds')
            .expect(200)
            .end((err, { body }) => {
                expect(body[0].name).toEqual(dto.name);
                expect(body[0].age).toEqual(dto.age);
                expect(body[0].breed).toEqual(dto.breed);
                done();
            });
    });

    afterEach(async () => {
        await app.close();
    });
});
