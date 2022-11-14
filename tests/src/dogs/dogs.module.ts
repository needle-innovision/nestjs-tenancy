import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TenancyModule } from '../../../lib';
import { DogsController } from './dogs.controller';
import { DogsService } from './dogs.service';
import { DogSchema, Dog } from './schemas/dog.schema';

@Module({
    imports: [
        TenancyModule.forFeature([{ name: Dog.name, schema: DogSchema }]), 
        ClientsModule.register([
            { name: 'DOGS_EVENT_BUS', transport: Transport.TCP },
        ]),
    ],
    controllers: [DogsController],
    providers: [DogsService],
})
export class DogsModule { }