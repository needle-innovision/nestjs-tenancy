import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { BeaglesService } from './beagles.service';
import { AnimalType } from './dto/animal-type.enum';
import { AnimalsDto, CreateAnimalDto } from './dto/composite-dtos';
import { CreateBeagleDto } from './dto/create-beagle.dto';
import { CreateMaineCoonDto } from './dto/create-maine-coon.dto';
import { MaineCoonsService } from './maine-coons.service';

@Controller('animals')
export class AnimalsController {
  constructor(
    private readonly catsService: MaineCoonsService,
    private readonly dogsService: BeaglesService,
  ) {}

  @Post()
  async create(@Body() createAnimalDto: CreateAnimalDto): Promise<AnimalsDto> {
    switch (createAnimalDto.animalType) {
      case AnimalType.MAINE_COON:
        return this.catsService.create(createAnimalDto as CreateMaineCoonDto);
      case AnimalType.BEAGLE:
        return this.dogsService.create(createAnimalDto as CreateBeagleDto);
      default:
        throw new Error('No such animal');
    }
  }

  @Get()
  async findAll(): Promise<AnimalsDto[]> {
    const promises = Promise.all([
      this.catsService.findAll(),
      this.dogsService.findAll(),
    ]);
    const results = await promises;
    return results.reduce((acc, curr) => {
      acc.push(...curr);
      return acc;
    }, [] as AnimalsDto[]);
  }

  // For e2e tests cleanup
  @Delete()
  async removeAll(): Promise<void> {
    await Promise.all([
      this.catsService.removeAll(),
      this.dogsService.removeAll(),
    ]);
  }
}
