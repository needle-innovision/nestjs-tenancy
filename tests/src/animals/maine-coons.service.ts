import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MaineCoonDto } from './dto/composite-dtos';
import { CreateMaineCoonDto } from './dto/create-maine-coon.dto';
import { MaineCoon } from './schemas/maine-coon.schema';

@Injectable()
export class MaineCoonsService {
  constructor(
    @InjectModel(MaineCoon.name)
    private readonly maineCoonModel: Model<MaineCoon>,
  ) {}

  async create(createDto: CreateMaineCoonDto): Promise<MaineCoonDto> {
    const created = new this.maineCoonModel(createDto);
    return created.save();
  }

  async findAll(): Promise<MaineCoonDto[]> {
    return this.maineCoonModel.find().lean().exec();
  }

  async removeAll(): Promise<void> {
    await this.maineCoonModel.deleteMany();
  }
}
