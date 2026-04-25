import { Provider, Scope } from '@nestjs/common';
import { Connection } from 'mongoose';
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
        if (!exists) {
          modelDefinitionMap.set(name, { ...definition });

          connectionMap.forEach((connection: Connection) => {
            connection.model(name, schema, collection);
          });
        }
      },
      inject: [MODEL_DEFINITION_MAP, CONNECTION_MAP],
    });

    // Creating Models with connections attached
    // NOTE: We inject the definition token to guarantee NestJS resolves it
    // BEFORE the model provider. Without this dependency, forwardRef can cause
    // the definition to not be registered in MODEL_DEFINITION_MAP when the
    // TENANT_CONNECTION is first resolved, leading to undefined models.
    providers.push({
      provide: getTenantModelToken(name),
      scope: Scope.REQUEST,
      useFactory(_definition: void, tenantConnection: Connection) {
        if (!tenantConnection) {
          throw new Error(
            `[TenancyModule] Tenant connection is null for model "${name}". ` +
              `Ensure the module importing TenancyModule.forFeature() is within a request scope ` +
              `that provides a valid tenant context.`,
          );
        }
        return (
          tenantConnection.models[name] ||
          tenantConnection.model(name, schema, collection)
        );
      },
      inject: [getTenantModelDefinitionToken(name), TENANT_CONNECTION],
    });
  }

  // Return the list of providers mapping
  return providers;
};
