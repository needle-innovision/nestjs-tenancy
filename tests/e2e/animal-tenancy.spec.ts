import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { AnimalType } from '../src/animals/dto/animal-type.enum';
import { CreateMaineCoonDto } from '../src/animals/dto/create-maine-coon.dto';
import { CreateBeagleDto } from '../src/animals/dto/create-beagle.dto';
import { AppModule } from '../src/app.module';

describe('AnimalTenancy', () => {
  let server: Server;
  let app: INestApplication;
  const dogs = generateDogs();
  const cats = generateCats();
  const TENANT_HEADER = 'X-TENANT-ID';
  const DOG_CLUB = 'dog-club';
  const CAT_CLUB = 'cat-club';

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpServer();
    await app.init();

    await cleanupTenantDb(CAT_CLUB);
    await cleanupTenantDb(DOG_CLUB);

    for (const dog of dogs) {
      await request(server)
        .post('/animals')
        .set(TENANT_HEADER, DOG_CLUB)
        .send(dog)
        .expect(201);
    }

    for (const cat of cats) {
      await request(server)
        .post('/animals')
        .set(TENANT_HEADER, CAT_CLUB)
        .send(cat)
        .expect(201);
    }
  });

  it(`each animal type must have all relevant fields`, (done) => {
    request(server)
      .get(`/animals`)
      .set(TENANT_HEADER, DOG_CLUB)
      .expect(200, (_err, { body }) => {
        body.forEach(({ animalType, isMajestic, isGood }) => {
          expect(animalType).toBe(AnimalType.BEAGLE);
          expect(isGood).toBe(true);
          expect(isMajestic).toBe(undefined);
        });

        done();
      });
    request(server)
      .get(`/animals`)
      .set(TENANT_HEADER, CAT_CLUB)
      .expect(200, (_err, { body }) => {
        body.forEach(({ animalType, isMajestic, isGood }) => {
          expect(animalType).toBe(AnimalType.MAINE_COON);
          expect(isMajestic).toBe(true);
          expect(isGood).toBe(undefined);
        });

        done();
      });
  });

  it(`dog-club tenant should see only dogs`, (done) => {
    request(server)
      .get(`/animals`)
      .set(TENANT_HEADER, DOG_CLUB)
      .expect(200, (_err, { body }) => {
        expect(body).toHaveLength(3);
        body.forEach(({ animalType }) => {
          expect(animalType).toBe(AnimalType.BEAGLE);
        });

        done();
      });
  });

  it(`cat-club tenant should see only cats`, (done) => {
    request(server)
      .get(`/animals`)
      .set(TENANT_HEADER, CAT_CLUB)
      .expect(200, (_err, { body }) => {
        expect(body).toHaveLength(3);
        body.forEach(({ animalType }) => {
          expect(animalType).toBe(AnimalType.MAINE_COON);
        });

        done();
      });
  });

  afterEach(async () => {
    await app.close();
  });

  async function cleanupTenantDb(tenantId: string) {
    return request(server).delete(`/animals`).set(TENANT_HEADER, tenantId);
  }
});

function generateCats(count = 3): CreateMaineCoonDto[] {
  return Array(count)
    .fill(0)
    .map((_, i) => ({
      animalType: AnimalType.MAINE_COON,
      age: i,
      breed: 'Maine coon',
      name: `Furrball ${i}`,
      isMajestic: true,
    }));
}

function generateDogs(count = 3): CreateBeagleDto[] {
  return Array(count)
    .fill(0)
    .map((_, i) => ({
      animalType: AnimalType.BEAGLE,
      age: i,
      breed: 'Beagle',
      name: `Fluffball ${i}`,
      isGood: true,
    }));
}
