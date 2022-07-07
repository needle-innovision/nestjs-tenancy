
import { Body, Controller, Get, Post } from '@nestjs/common';
import { BirdsService } from './birds.service';
import { CreateBirdDto } from './dto/create-bird.dto';
import { Bird } from './schemas/bird.schema';

@Controller('birds')
export class BirdsController {
    constructor(private readonly service: BirdsService) { }

    @Post()
    async create(@Body() dto: CreateBirdDto) {
        return this.service.create(dto);
    }

    @Get()
    async findAll(): Promise<Bird[]> {
        return this.service.findAll();
    }
}
