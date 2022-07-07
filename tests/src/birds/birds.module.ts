import { BirdsService } from './birds.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BirdsController } from './bird.controller';
import { Bird, BirdSchema } from './schemas/bird.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Bird.name, schema: BirdSchema }])
    ],
    controllers: [BirdsController],
    providers: [BirdsService],
})
export class BirdsModule { }
