import { BirdsModule } from './birds/birds.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenancyModule } from '../../lib';
import { CatsModule } from './cats/cats.module';
import { DogsModule } from './dogs/dogs.module';

@Module({
    imports: [
        MongooseModule.forRoot('mongodb://127.0.0.1:27017/test'),
        TenancyModule.forRoot({
            tenantIdentifier: 'X-TENANT-ID',
            options: () => { },
            skipTenantCheck: (req) => {
                return req.route.path.match(/^\/birds*/) != null;
            },
            uri: (tenantId: string) => `mongodb://127.0.0.1:27017/test-tenant-${tenantId}`,

        }),
        CatsModule,
        DogsModule,
        BirdsModule
    ],
})
export class AppModule { }
