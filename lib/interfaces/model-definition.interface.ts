import { Schema } from 'mongoose';

export interface ModelDefinition {
    name: string;
    schema: Schema;
    collection?: string;
}
