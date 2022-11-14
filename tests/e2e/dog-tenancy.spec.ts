import { INestApplication } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('DogTenancy', () => {
    let server: Server;
    let app: INestApplication;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = module.createNestApplication();
        server = app.getHttpServer();
        app.connectMicroservice({
            transport: Transport.TCP,
        });
      
        await app.startAllMicroservices();

        await app.init();
    });

    it(`should return created document`, (done) => {
        const createDto = { name: 'Charlie', breed: 'Beagle', age: 6 };
        request(server)
            .post('/dogs')
            .set('X-TENANT-ID', 'dogs')
            .send(createDto)
            .expect(201)
            .end((err, { body }) => {
                expect(body.name).toEqual(createDto.name);
                expect(body.age).toEqual(createDto.age);
                expect(body.breed).toEqual(createDto.breed);
                done();
            });
    });


    it(`should return 99 cats from the cats tenant`, (done) => { 
        request(server)
            .get('/dogs/count_cats')
            .set('X-TENANT-ID', 'dogs')
            .send()
            .expect(200)
            .end((err, { body }) => { 
                expect(body.count).toEqual(99); 
                done();
            });
    });


    afterEach(async () => {
        await app.close();
    });
});