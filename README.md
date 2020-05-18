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
import { TenancyModule } from '../../../lib';
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
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './schemas/cat.schema';

@Injectable()
export class CatsService {
    constructor(
        @InjectModel(Cat.name) private readonly catModel: Model<Cat>
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
