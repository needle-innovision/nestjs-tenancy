import { AnimalType } from './animal-type.enum';
import { AnimalDto } from './animal.dto';

export class CreateMaineCoonDto extends AnimalDto {
  readonly animalType: AnimalType = AnimalType.MAINE_COON;
  readonly isMajestic: true;
}
