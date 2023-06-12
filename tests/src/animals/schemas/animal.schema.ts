import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AnimalType } from '../dto/animal-type.enum';

@Schema({ discriminatorKey: 'animalType' })
export class Animal extends Document {
  animalType: AnimalType;

  @Prop()
  name: string;

  @Prop({ type: Number })
  age: number;

  @Prop()
  breed: string;
}

export const AnimalSchema = SchemaFactory.createForClass(Animal);
