import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { CreateDogDto } from './dto/create-dog.dto';
import { Dog } from './schemas/dog.schema';

@Injectable()
export class DogsService {
    constructor(
        @InjectModel(Dog.name) private readonly dogModel: Model<Dog>,
        @Inject('DOG_SERVICE') private client: ClientProxy,
    ) { }

    async create(createDogDto: CreateDogDto): Promise<Dog> {
        const createdDog = new this.dogModel(createDogDto);
        return createdDog.save();
    }

    async findAll(): Promise<Dog[]> {
        return this.dogModel.find().exec();
    }

    async countCats(): Promise<number> {
        return await firstValueFrom(this.client.send({
            cmd:'count_cats'
        }, null));
    }
} 