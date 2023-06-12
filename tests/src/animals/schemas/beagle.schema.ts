import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Animal } from './animal.schema';

@Schema()
export class Beagle extends Animal {
  @Prop({ type: Boolean })
  isGood: boolean;
}

export const BeagleSchema = SchemaFactory.createForClass(Beagle);
