import { AnimalDto } from './animal.dto';
import { CreateMaineCoonDto } from './create-maine-coon.dto';
import { CreateBeagleDto } from './create-beagle.dto';

export type CreateAnimalDto = CreateBeagleDto | CreateMaineCoonDto;

export interface MaineCoonDto extends AnimalDto {
  isMajestic: boolean;
  isGood?: never;
}
export interface BeagleDto extends AnimalDto {
  isGood: boolean;
  isMajestic?: never;
}

export type AnimalsDto = BeagleDto | MaineCoonDto;
