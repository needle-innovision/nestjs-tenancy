import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Animal } from './animal.schema';

@Schema()
export class MaineCoon extends Animal {
  @Prop({ type: Boolean })
  isMajestic: boolean;
}

export const MaineCoonSchema = SchemaFactory.createForClass(MaineCoon);
