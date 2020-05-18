import { DynamicModule, Global, Module } from '@nestjs/common';
import { createTeanancyProviders } from './factories';
import { ModelDefinition } from './interfaces';

@Global()
@Module({})
export class TenancyFeatureModule {

    static register(models: ModelDefinition[]): DynamicModule {
        const providers = createTeanancyProviders(models);

        return {
            module: TenancyFeatureModule,
            providers,
            exports: providers,
        };
    }

}
