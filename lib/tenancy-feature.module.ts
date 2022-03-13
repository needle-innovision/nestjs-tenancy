import { DynamicModule, Global, Module } from '@nestjs/common';
import { createTenancyProviders } from './factories';
import { ModelDefinition } from './interfaces';

@Global()
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
