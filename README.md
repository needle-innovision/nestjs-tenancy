# nestjs-tenancy

## Description

[Mongoose](http://mongoosejs.com/) multitenancy module for [Nest](https://github.com/nestjs/nest).

## Installation

```bash
$ npm i --save @needle-innovision/nestjs-tenancy
```

## Basic usage

**app.module.ts**

```typescript
import { Module } from "@nestjs/common";
import { TenancyModule } from "@needle-innovision/nestjs-tenancy";
import { CatsModule } from "./cat.module.ts";

@Module({
  imports: [
    TenancyModule.forRoot({
        tenantIdentifier: 'X-TENANT-ID',
        options: {},
        uri: (tenantId: string) => `mongodb://localhost/test-tenant-${tenantId}`,
    }),
    CatsModule,
  ],
})
export class AppModule {}
```

Create class that describes your schema

**cat.model.ts**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Cat extends Document {
    @Prop()
    name: string;

    @Prop()
    age: number;

    @Prop()
    breed: string;
}

export const CatSchema = SchemaFactory.createForClass(Cat);
```

Inject Cat for `CatsModule`

**cat.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TenancyModule } from '@needle-innovision/nestjs-tenancy';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { Cat, CatSchema } from './schemas/cat.schema';

@Module({
    imports: [
        TenancyModule.forFeature([{ name: Cat.name, schema: CatSchema }])
    ],
    controllers: [CatsController],
    providers: [CatsService],
})
export class CatsModule { }
```

Get the cat model in a service

**cats.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectTenancyModel } from '@needle-innovision/nestjs-tenancy';
import { Model } from 'mongoose';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './schemas/cat.schema';

@Injectable()
export class CatsService {
    constructor(
        @InjectTenancyModel(Cat.name) private readonly catModel: Model<Cat>
    ) { }

    async create(createCatDto: CreateCatDto): Promise<Cat> {
        const createdCat = new this.catModel(createCatDto);
        return createdCat.save();
    }

    async findAll(): Promise<Cat[]> {
        return this.catModel.find().exec();
    }
}
```

Finally, use the service in a controller!

**cats.controller.ts**

```typescript

import { Body, Controller, Get, Post } from '@nestjs/common';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './schemas/cat.schema';

@Controller('cats')
export class CatsController {
    constructor(private readonly catsService: CatsService) { }

    @Post()
    async create(@Body() createCatDto: CreateCatDto) {
        return this.catsService.create(createCatDto);
    }

    @Get()
    async findAll(): Promise<Cat[]> {
        return this.catsService.findAll();
    }
}
```

## Adding custom validators for the tenant

Let's say you want to handle a validation check to see if your tenant is registered. You can do 
this by implementing the `TenancyValidator` interface and writing your own validation logic inside
the `validate` method. The library invokes this method internally.

**custom-tenant.validator.ts**

```typescript
import { TenancyValidator } from '@app/tenancy';
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITenantModel } from '../../core/models/tenant.model';

@Injectable()
export class CustomTenantValidator implements TenancyValidator {
    private _tenantId: string;

    // This`Tenant` model definition schema is mapped to the common database and
    // not into the tenant database.
    constructor(@InjectModel('Tenant') private tenantModel: Model<ITenantModel>) { }

    /**
     * Method to set the tenant id
     *
     * @param {string} tenantId
     * @returns
     * @memberof CustomTenantValidator
     */
    setTenantId(tenantId: string): TenancyValidator {
        this._tenantId = tenantId;
        return this; // Make sure to return the instance of the class back here.
    }

    /**
     * Your Custom Validation to verify if tenant exist in the common database
     *
     * Note: This method will be invoked by the library internally when
     * tenant id is present in the context.
     *
     * @returns {Promise<void>}
     * @memberof CustomTenantValidator
     */
    async validate(): Promise<void> {
        const exist = await this.tenantModel.exists({ name: this._tenantId });
        if (!exist) {
            throw new NotFoundException(`Tenant not found`);
        }
    }
}
```

Export the validator from your tenant module

**tenant.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantSchema } from '../core/schemas/tenant.schema';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { CustomTenantValidator } from './validators/custom-tenant.validator';

@Module({
  imports: [
    // Here the connection represents the common database
    MongooseModule.forFeature([{ name: 'Tenant', schema: TenantSchema }])
  ],
  controllers: [TenantController],
  providers: [
    TenantService,
    // Your custom validator
    CustomTenantValidator,
  ],
  exports: [
    TenantService,
    CustomTenantValidator,
  ]
})
export class TenantModule {}
```

Export the database configuration

**config.ts**

```
export default () => ({
    database: {
        uri: process.env.MONGO_URI
    }
});
```

Finally you will also need to modify the module configuration.

**app.module.ts**

```typescript
import { Module } from "@nestjs/common";
import { TenancyModule } from "@needle-innovision/nestjs-tenancy";
import { CatsModule } from "./cat.module.ts";
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config';
import { TenantModule } from './tenant/tenant.module';
import { CustomTenantValidator } from './tenant/validators/custom-tenant.validator';

@Module({
  imports: [
    // Load the default configuration file
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
    }),
    // Mongoose default connection
    MongooseModule.forRootAsync({
      useFactory: async (cfs: ConfigService) => cfs.get('database'),
      inject: [ConfigService],
    }),
    // Tenant async configuration
    TenancyModule.forRootAsync({
      imports: [TenantModule],
      useFactory: async (cfs: ConfigService, tVal: CustomTenantValidator) => {
        return {
          // Base tenant configurations
          tenantIdentifier: 'X-TENANT-ID',
          options: () => {},
          uri: (tenantId: string) => `mongodb://localhost/test-tenant-${tenantId}`,
          // Custom validator to check if the tenant exist in common database
          validator: (tenantId: string) => tVal.setTenantId(tenantId),
        }
      },
      inject: [ConfigService, CustomTenantValidator],
    }),
    CatsModule,
  ],
})
export class AppModule {}
```

## Subdomain support

This library also enables the extraction of tenant id from the sudomain of the url.
For enabling this you need to modify your configuration like below.

**app.module.ts**

```typescript
import { Module } from "@nestjs/common";
import { TenancyModule } from "@needle-innovision/nestjs-tenancy";
import { CatsModule } from "./cat.module.ts";

@Module({
  imports: [
    TenancyModule.forRoot({
        // This will allow the library to extract the subdomain as tenant id
        isTenantFromSubdomain: true,
        options: () => {},
        uri: (tenantId: string) => `mongodb://localhost/test-tenant-${tenantId}`,
    }),
    CatsModule,
  ],
})
export class AppModule {}
```

## Requirements

1.  @nest/mongoose +6.4.0
2.  @nestjs/common +6.10.1
3.  @nestjs/core +6.10.1
4.  mongoose (with typings `@types/mongoose`) +5.7.12

## Test

```bash
# e2e tests
$ npm run test:e2e
```

## Stay in touch

- Author - [Sandeep K](https://github.com/sandeepsuvit)

## License

  Nest is [MIT licensed](LICENSE).
