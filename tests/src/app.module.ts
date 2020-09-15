import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenancyModule } from '../../lib';
import { CatsModule } from './cats/cats.module';
import { DogsModule } from './dogs/dogs.module';

@Module({
    imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test'),
        TenancyModule.forRoot({
            tenantIdentifier: 'X-TENANT-ID',
            options: () => { },
            uri: (tenantId: string) => `mongodb://localhost/test-tenant-${tenantId}`,
        }),
        CatsModule,
        DogsModule,
    ],
})
export class AppModule { }