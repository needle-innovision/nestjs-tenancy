import { DynamicModule, Global, HttpException, HttpStatus, Module, OnApplicationShutdown, Provider, Scope } from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { ModuleRef, REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Connection, createConnection } from 'mongoose';
import { TenancyModuleAsyncOptions, TenancyModuleOptions, TenancyOptionsFactory } from './interfaces';
import { CONNECTION_MAP, MODEL_DEFINITION_MAP, TENANT_CONNECTION, TENANT_CONTEXT, TENANT_MODULE_OPTIONS } from './tenancy.constants';
import { ConnectionMap, ModelDefinitionMap } from './types';

@Global()
@Module({})
export class TenancyCoreModule implements OnApplicationShutdown {
    constructor(
        private readonly moduleRef: ModuleRef,
    ) { }

    /**
     * Register for synchornous modules
     *
     * @static
     * @param {TenancyModuleOptions} options
     * @returns {DynamicModule}
     * @memberof TenancyCoreModule
     */
    static register(options: TenancyModuleOptions): DynamicModule {

        /* Module options */
        const tenancyModuleOptionsProvider = {
            provide: TENANT_MODULE_OPTIONS,
            useValue: { ...options },
        };

        /* Connection Map */
        const connectionMapProvider = this.createConnectionMapProvider();

        /* Model Definition Map */
        const modelDefinitionMapProvider = this.createModelDefinitionMapProvider();       

        /* Tenant Context */
        const tenantContextProvider = this.createTenantContextProvider();

        /* Tenant Connection */
        const tenantConnectionProvider = {
            provide: TENANT_CONNECTION,
            useFactory: async (
                tenantId: string,
                moduleOptions: TenancyModuleOptions,
                connMap: ConnectionMap,
                modelDefMap: ModelDefinitionMap,
            ): Promise<Connection> => {
                return await this.getConnection(tenantId, moduleOptions, connMap, modelDefMap);
            },
            inject: [
                TENANT_CONTEXT,
                TENANT_MODULE_OPTIONS,
                CONNECTION_MAP,
                MODEL_DEFINITION_MAP,
            ],
        };

        const providers = [
            tenancyModuleOptionsProvider,
            tenantContextProvider,
            connectionMapProvider,
            modelDefinitionMapProvider,
            tenantConnectionProvider,
        ];

        return {
            module: TenancyCoreModule,
            providers,
            exports: providers,
        };
    }

    /**
     * Register for asynchronous modules
     *
     * @static
     * @param {TenancyModuleAsyncOptions} options
     * @returns {DynamicModule}
     * @memberof TenancyCoreModule
     */
    static registerAsync(options: TenancyModuleAsyncOptions): DynamicModule {

        /* Connection Map */
        const connectionMapProvider = this.createConnectionMapProvider();

        /* Model Definition Map */
        const modelDefinitionMapProvider = this.createModelDefinitionMapProvider();

        /* Tenant Context */
        const tenantContextProvider = this.createTenantContextProvider();
        
        /* Tenant Connection */
        const tenantConnectionProvider = {
            provide: TENANT_CONNECTION,
            useFactory: async (
                tenantId: string,
                moduleOptions: TenancyModuleOptions,
                connMap: ConnectionMap,
                modelDefMap: ModelDefinitionMap,
            ): Promise<Connection> => {
                return await this.getConnection(tenantId, moduleOptions, connMap, modelDefMap);
            },
            inject: [
                TENANT_CONTEXT,
                TENANT_MODULE_OPTIONS,
                CONNECTION_MAP,
                MODEL_DEFINITION_MAP,
            ]
        };

        /* Asyc providers */
        const asyncProviders = this.createAsyncProviders(options);

        const providers = [
            ...asyncProviders,
            tenantContextProvider,
            connectionMapProvider,
            modelDefinitionMapProvider,
            tenantConnectionProvider,
        ];

        return {
            module: TenancyCoreModule,
            imports: options.imports,
            providers: providers,
            exports: providers
        };
    }

    /**
     * Override method from `OnApplicationShutdown`
     *
     * @memberof TenantCoreModule
     */
    async onApplicationShutdown() {
        // Map of all connections
        const connectionMap: ConnectionMap = this.moduleRef.get(CONNECTION_MAP);

        // Remove all stray connections
        await Promise.all(
            [...connectionMap.values()].map(connection => connection.close()),
        );
    }

    /**
     * Get Tenant id from the request
     *
     * @private
     * @static
     * @param {Request} req
     * @param {TenancyModuleOptions} moduleOptions
     * @returns {string}
     * @memberof TenancyCoreModule
     */
    private static getTenant(
        req: Request,
        moduleOptions: TenancyModuleOptions,
    ): string {
        let tenantId = '';

        if (!moduleOptions) {
            throw new HttpException(`Tenant options are mandatory`, HttpStatus.BAD_REQUEST);
        }

        // Extract the tenant idetifier
        const {
            tenantIdentifier = null,
            isTenantFromSubdomain = false,
        } = moduleOptions;

        // Pull the tenant id from the subdomain
        if (isTenantFromSubdomain) {
            tenantId = req.subdomains[0] || '';

            // Validate if tenant identifier token is present
            if (tenantId === '') {
                throw new HttpException(`Tenant ID is mandatory`, HttpStatus.BAD_REQUEST);
            }
        } else {
            // Validate if tenant identifier token is present
            if (!tenantIdentifier) {
                throw new HttpException(`${tenantIdentifier} is mandatory`, HttpStatus.BAD_REQUEST);
            }

            // Get the tenant id from the request
            if (req.headers) {
                tenantId = req.headers[`${tenantIdentifier}`] || '';
            } else {
                tenantId = req.get(`${tenantIdentifier}`) || '';
            }    

            // Validate if tenant id is present
            if (tenantId === '') {
                throw new HttpException(`${tenantIdentifier} is not supplied`, HttpStatus.BAD_REQUEST);
            }
        }

        return tenantId;
    }
    
    /**
     * Get the connection for the tenant
     *
     * @private
     * @static
     * @param {String} tenantId
     * @param {TenancyModuleOptions} moduleOptions
     * @param {ConnectionMap} connMap
     * @param {ModelDefinitionMap} modelDefMap
     * @returns {Promise<Connection>}
     * @memberof TenancyCoreModule
     */
    private static async getConnection(
        tenantId: string,
        moduleOptions: TenancyModuleOptions,
        connMap: ConnectionMap,
        modelDefMap: ModelDefinitionMap,
    ): Promise<Connection> {
        // Check if validator is set, if so call the `validate` method on it
        if (moduleOptions.validator) {
            await moduleOptions.validator(tenantId).validate();
        }
        
        // Check if tenantId exist in the connection map
        const exists = connMap.has(tenantId);

        // Return the connection if exist
        if (exists) {
            return connMap.get(tenantId);
        }
        
        // Otherwise create a new connection
        const connection = createConnection(moduleOptions.uri(tenantId), {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ...moduleOptions.options,
        });

        // Attach connection to the models passed in the map
        modelDefMap.forEach((definition: any) => {
            const { name, schema, collection } = definition;
            connection.model(name, schema, collection);
        });

        // Add the new connection to the map
        connMap.set(tenantId, connection);

        return connection;
    }

    /**
     * Create connection map provider
     *
     * @private
     * @static
     * @returns {Provider}
     * @memberof TenancyCoreModule
     */
    private static createConnectionMapProvider(): Provider {
        return {
            provide: CONNECTION_MAP,
            useFactory: (): ConnectionMap => new Map(),
        }
    }

    /**
     * Create model definition map provider
     *
     * @private
     * @static
     * @returns {Provider}
     * @memberof TenancyCoreModule
     */
    private static createModelDefinitionMapProvider(): Provider {
        return {
            provide: MODEL_DEFINITION_MAP,
            useFactory: (): ModelDefinitionMap => new Map(),
        }
    }

    /**
     * Create tenant context provider
     *
     * @private
     * @static
     * @returns {Provider}
     * @memberof TenancyCoreModule
     */
    private static createTenantContextProvider(): Provider {
        return {
            provide: TENANT_CONTEXT,
            scope: Scope.REQUEST,
            useFactory: (
                req: Request,
                moduleOptions: TenancyModuleOptions,
            ) => this.getTenant(req, moduleOptions),
            inject: [
                REQUEST,
                TENANT_MODULE_OPTIONS,
            ]
        }
    }
    
    /**
     * Create options providers
     *
     * @private
     * @static
     * @param {TenancyModuleAsyncOptions} options
     * @returns {Provider[]}
     * @memberof TenancyCoreModule
     */
    private static createAsyncProviders(
        options: TenancyModuleAsyncOptions,
    ): Provider[] {
        if (options.useExisting || options.useFactory) {
            return [this.createAsyncOptionsProvider(options)];
        }

        const useClass = options.useClass as Type<TenancyOptionsFactory>;

        return [
            this.createAsyncOptionsProvider(options),
            {
                provide: useClass,
                useClass,
            },
        ];
    }

    /**
     * Create options provider
     *
     * @private
     * @static
     * @param {TenancyModuleAsyncOptions} options
     * @returns {Provider}
     * @memberof TenancyCoreModule
     */
    private static createAsyncOptionsProvider(
        options: TenancyModuleAsyncOptions,
    ): Provider {
        if(options.useFactory) {
            return {
                provide: TENANT_MODULE_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            };
        }

        const inject = [
            (options.useClass || options.useExisting) as Type<TenancyOptionsFactory>,
        ];

        return {
            provide: TENANT_MODULE_OPTIONS,
            useFactory: async (optionsFactory: TenancyOptionsFactory) => 
                await optionsFactory.createTenancyOptions(),
            inject,
        };
    }
}
