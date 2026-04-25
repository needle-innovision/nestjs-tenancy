import { DynamicModule, Module } from '@nestjs/common';
import { createTenancyProviders } from './factories';
import {
  ModelDefinition,
  TenancyModuleAsyncOptions,
  TenancyModuleOptions,
} from './interfaces';
import { TenancyCoreModule } from './tenancy-core.module';

/**
 * Module to help with multi tenancy
 *
 * For root configutaion:
 * ```ts
 * TenancyModule.forRoot({
 *    tenantIdentifier: 'X-TenantId',
 *    options: {},
 *    uri: (tenantId: string) => `mongodb://localhost/tenant-${tenantId}`,
 * })
 * ```
 *
 * For root async configuration:
 * ```ts
 * TenancyModule.forRootAsync({
 *    useFactory: async (cfs: ConfigService) => cfs.get('tenant'),
 *    inject: [ConfigService],
 * })
 *```
 *
 * For feature configurations:
 * ```ts
 * TenancyModule.forFeature([{ name: 'Account', schema: AccountSchema }])
 *```
 * @export
 * @class TenancyModule
 */
@Module({})
export class TenancyModule {
  /**
   * For root synchronous imports
   *
   * @static
   * @param {TenancyModuleOptions} options
   * @returns {DynamicModule}
   * @memberof TenancyModule
   */
  static forRoot(options: TenancyModuleOptions): DynamicModule {
    return {
      module: TenancyModule,
      imports: [TenancyCoreModule.register(options)],
    };
  }

  /**
   * For root asynchronous imports
   *
   * @static
   * @param {TenancyModuleAsyncOptions} options
   * @returns {DynamicModule}
   * @memberof TenancyModule
   */
  static forRootAsync(options: TenancyModuleAsyncOptions): DynamicModule {
    return {
      module: TenancyModule,
      imports: [TenancyCoreModule.registerAsync(options)],
    };
  }

  /**
   * For feature module imports
   *
   * @static
   * @param {ModelDefinition[]} models
   * @returns {DynamicModule}
   * @memberof TenancyModule
   */
  static forFeature(models: ModelDefinition[]): DynamicModule {
    const providers = createTenancyProviders(models);

    return {
      module: TenancyModule,
      providers,
      exports: providers,
    };
  }
}
