import { AnimalType } from './animal-type.enum';
import { AnimalDto } from './animal.dto';

export class CreateBeagleDto extends AnimalDto {
  readonly animalType: AnimalType = AnimalType.BEAGLE;
  readonly isGood: true;
}
