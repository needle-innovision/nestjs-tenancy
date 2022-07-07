import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBirdDto } from './dto/create-bird.dto';
import { Bird } from './schemas/bird.schema';

@Injectable()
export class BirdsService {
    constructor(
        @InjectModel(Bird.name) private readonly birdModel: Model<Bird>
    ) { }

    async create(dto: CreateBirdDto): Promise<Bird> {
        const bird = new this.birdModel(dto);
        return bird.save();
    }

    async findAll(): Promise<Bird[]> {
        return this.birdModel.find().exec();
    }
}
