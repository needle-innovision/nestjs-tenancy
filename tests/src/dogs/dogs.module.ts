import { Module } from '@nestjs/common';
import { TenancyModule } from '../../../lib';
import { DogsController } from './dogs.controller';
import { DogsService } from './dogs.service';
import { DogSchema, Dog } from './schemas/dog.schema';

@Module({
    imports: [
        TenancyModule.forFeature([{ name: Dog.name, schema: DogSchema }])
    ],
    controllers: [DogsController],
    providers: [DogsService],
})
export class DogsModule { }