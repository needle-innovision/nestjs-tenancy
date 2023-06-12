import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BeagleDto } from './dto/composite-dtos';
import { CreateBeagleDto } from './dto/create-beagle.dto';
import { Beagle } from './schemas/beagle.schema';

@Injectable()
export class BeaglesService {
  constructor(
    @InjectModel(Beagle.name) private readonly beagleModel: Model<Beagle>,
  ) {}

  async create(createDto: CreateBeagleDto): Promise<BeagleDto> {
    const created = new this.beagleModel(createDto);
    return created.save();
  }

  async findAll(): Promise<BeagleDto[]> {
    return this.beagleModel.find().lean().exec();
  }

  async removeAll(): Promise<void> {
    await this.beagleModel.deleteMany();
  }
}
