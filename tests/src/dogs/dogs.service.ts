import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDogDto } from './dto/create-dog.dto';
import { Dog } from './schemas/dog.schema';

@Injectable()
export class DogsService {
    constructor(
        @InjectModel(Dog.name) private readonly dogModel: Model<Dog>
    ) { }

    async create(createDogDto: CreateDogDto): Promise<Dog> {
        const createdDog = new this.dogModel(createDogDto);
        return createdDog.save();
    }

    async findAll(): Promise<Dog[]> {
        return this.dogModel.find().exec();
    }
}