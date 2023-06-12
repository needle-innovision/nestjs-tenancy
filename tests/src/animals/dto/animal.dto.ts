import { AnimalType } from './animal-type.enum';

export class AnimalDto {
  readonly animalType: AnimalType;
  readonly name: string;
  readonly age: number;
  readonly breed: string;
}
