import { Provider } from '@nestjs/common';
import { Connection, Model } from 'mongoose';
import { ModelDefinition } from '../interfaces';
import {
  CONNECTION_MAP,
  MODEL_DEFINITION_MAP,
  TENANT_CONNECTION,
} from '../tenancy.constants';
import { ConnectionMap, ModelDefinitionMap } from '../types';
import { getTenantModelDefinitionToken, getTenantModelToken } from '../utils';

export const createTenancyProviders = (
  definitions: ModelDefinition[],
): Provider[] => {
  const providers: Provider[] = [];

  for (const definition of definitions) {
    // Extract the definition data
    const { name, schema, collection } = definition;

    providers.push({
      provide: getTenantModelDefinitionToken(name),
      useFactory: (
        modelDefinitionMap: ModelDefinitionMap,
        connectionMap: ConnectionMap,
      ) => {
        const exists = modelDefinitionMap.has(name);
        if (exists) return;

        modelDefinitionMap.set(name, { ...definition });

        connectionMap.forEach((connection: Connection) => {
          connection.model(name, schema, collection);
        });
      },
      inject: [MODEL_DEFINITION_MAP, CONNECTION_MAP],
    });

    // Creating Models with connections attached
    providers.push({
      provide: getTenantModelToken(name),
      useFactory(tenantConnection: Connection) {
        return (
          tenantConnection.models[name] ||
          tenantConnection.model(name, schema, collection)
        );
      },
      inject: [TENANT_CONNECTION],
    });

    // Create descriminators
    const discriminators = definition.discriminators || [];
    providers.push(
      ...discriminators.map((discriminator) => ({
        provide: getTenantModelToken(discriminator.name),
        useFactory: (
          baseModel: Model<Document>,
          tenantConnection: Connection,
        ) => {
          const modelOnConnection = tenantConnection.models[discriminator.name];
          if (modelOnConnection) return modelOnConnection;

          const discriminatorModel = baseModel.discriminator(
            discriminator.name,
            discriminator.schema,
            discriminator.value,
          );
          return tenantConnection.model(
            discriminator.name,
            discriminatorModel.schema,
            collection,
          );
        },
        inject: [getTenantModelToken(name), TENANT_CONNECTION],
      })),
    );
  }

  // Return the list of providers mapping
  return providers;
};
