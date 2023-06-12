import { DiscriminatorOptions, ObjectId, Schema } from 'mongoose';

export type Discriminator = {
  name: string;
  schema: Schema;
  value?: string | number | ObjectId | DiscriminatorOptions;
};

export interface ModelDefinition {
  name: string;
  schema: Schema;
  collection?: string;
  discriminators?: Discriminator[];
}
