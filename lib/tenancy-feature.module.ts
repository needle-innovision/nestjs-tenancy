import { DynamicModule, Module } from '@nestjs/common';
import { createTenancyProviders } from './factories';
import { ModelDefinition } from './interfaces';

@Module({})
export class TenancyFeatureModule {
  static register(models: ModelDefinition[]): DynamicModule {
    const providers = createTenancyProviders(models);

    return {
      module: TenancyFeatureModule,
      providers,
      exports: providers,
    };
  }
}
