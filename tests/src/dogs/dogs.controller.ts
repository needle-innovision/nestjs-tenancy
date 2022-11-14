import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { DogsService } from './dogs.service';
import { CreateDogDto } from './dto/create-dog.dto';
import { CatCountDto } from './dto/cat-count-dto';
import { Dog } from './schemas/dog.schema';

@Controller('dogs')
export class DogsController {
    constructor(private readonly dogsService: DogsService) { }

    @Post()
    async create(@Body() createDogDto: CreateDogDto) {
        return this.dogsService.create(createDogDto);
    }

    @Get()
    async findAll(): Promise<Dog[]> {
        return this.dogsService.findAll();
    }

    @Get('count_cats')
    @HttpCode(200)
    async countCats(): Promise<CatCountDto> {
            
        const count = await this.dogsService.countCats();

        const res: CatCountDto = {
            count
        }
        return res;
    }
}