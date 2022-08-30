import { Schema } from 'mongoose';

// Fix for Issue#31
export type DiscriminatorOptions = {
    name: string;
    schema: Schema;
    value?: string;
};

export interface ModelDefinition {
    name: string;
    schema: Schema;
    collection?: string;
    // Fix for Issue#31
    discriminators?: DiscriminatorOptions[];
}
