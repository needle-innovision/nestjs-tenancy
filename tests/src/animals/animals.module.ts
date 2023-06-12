import { Module } from '@nestjs/common';
import { TenancyModule } from '../../../lib';
import { AnimalsController } from './animals.controller';
import { BeaglesService } from './beagles.service';
import { MaineCoonsService } from './maine-coons.service';
import { Animal, AnimalSchema } from './schemas/animal.schema';
import { Beagle, BeagleSchema } from './schemas/beagle.schema';
import { MaineCoon, MaineCoonSchema } from './schemas/maine-coon.schema';

@Module({
  imports: [
    TenancyModule.forFeature([
      {
        name: Animal.name,
        schema: AnimalSchema,
        discriminators: [
          { name: MaineCoon.name, schema: MaineCoonSchema },
          { name: Beagle.name, schema: BeagleSchema },
        ],
      },
    ]),
  ],
  controllers: [AnimalsController],
  providers: [BeaglesService, MaineCoonsService],
})
export class AnimalsModule {}
