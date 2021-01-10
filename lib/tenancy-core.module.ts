import { BadRequestException, DynamicModule, Global, Module, OnApplicationShutdown, Provider, Scope } from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { HttpAdapterHost, ModuleRef, REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Connection, createConnection } from 'mongoose';
import { TenancyModuleAsyncOptions, TenancyModuleOptions, TenancyOptionsFactory } from './interfaces';
import { CONNECTION_MAP, DEFAULT_HTTP_ADAPTER_HOST, MODEL_DEFINITION_MAP, TENANT_CONNECTION, TENANT_CONTEXT, TENANT_MODULE_OPTIONS } from './tenancy.constants';
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

        /* Http Adaptor */
        const httpAdapterHost = this.createHttpAdapterProvider();

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
            httpAdapterHost,
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

        /* Http Adaptor */
        const httpAdapterHost = this.createHttpAdapterProvider();
        
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
            httpAdapterHost,
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
     * @param {HttpAdapterHost} adapterHost
     * @returns {string}
     * @memberof TenancyCoreModule
     */
    private static getTenant(
        req: Request,
        moduleOptions: TenancyModuleOptions,
        adapterHost: HttpAdapterHost,
    ): string {
        // Check if the adaptor is fastify
        const isFastifyAdaptor = this.adapterIsFastify(adapterHost);

        if (!moduleOptions) {
            throw new BadRequestException(`Tenant options are mandatory`);
        }

        // Extract the tenant idetifier
        const {
            tenantIdentifier = null,
            isTenantFromSubdomain = false,
        } = moduleOptions;

        // Pull the tenant id from the subdomain
        if (isTenantFromSubdomain) {

            return this.getTenantFromSubdomain(req);

        } else {
            // Validate if tenant identifier token is present
            if (!tenantIdentifier) {
                throw new BadRequestException(`${tenantIdentifier} is mandatory`);
            }

            return this.getTenantFromRequest(isFastifyAdaptor, req, tenantIdentifier);
        }
    }
    
    /**
     * Get the Tenant information from the request object
     *
     * @private
     * @static
     * @param {boolean} isFastifyAdaptor
     * @param {Request} req
     * @param {string} tenantIdentifier
     * @returns
     * @memberof TenancyCoreModule
     */
    private static getTenantFromRequest(isFastifyAdaptor: boolean, req: Request, tenantIdentifier: string) {
        let tenantId = '';

        if (isFastifyAdaptor) { // For Fastify
            // Get the tenant id from the header
            tenantId = req.headers[`${tenantIdentifier || ''}`.toLowerCase()]?.toString() || '';
        } else { // For Express - Default
            // Get the tenant id from the request
            tenantId = req.get(`${tenantIdentifier}`) || '';
        }

        // Validate if tenant id is present
        if (this.isEmpty(tenantId)) {
            throw new BadRequestException(`${tenantIdentifier} is not supplied`);
        }
        
        return tenantId;
    }

    /**
     * Get the Tenant information from the reqest header
     *
     * @private
     * @static
     * @param {boolean} isFastifyAdaptor
     * @param {Request} req
     * @returns
     * @memberof TenancyCoreModule
     */
    private static getTenantFromSubdomain(req: Request) {
        const subdomains = this.getSubdomainsForFastify(req);

        let tenantId = '';
        if (subdomains instanceof Array && subdomains.length > 0) {
            tenantId = subdomains[subdomains.length - 1];
        }

        // Validate if tenant identifier token is present
        if (this.isEmpty(tenantId)) {
            throw new BadRequestException(`Tenant ID is mandatory`);
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
            const connection = connMap.get(tenantId) as Connection;

            if (moduleOptions.forceCreateCollections) {
                // For transactional support the Models/Collections has exist in the 
                // tenant database, otherwise it will throw error
                await Promise.all(
                    Object.entries(connection.models).map(([k, m]) => m.createCollection())
                );
            }

            return connection;
        }
        
        // Otherwise create a new connection
        const connection = createConnection(moduleOptions.uri(tenantId), {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ...moduleOptions.options(),
        });

        // Attach connection to the models passed in the map
        modelDefMap.forEach(async (definition: any) => {
            const { name, schema, collection } = definition;
            const modelCreated = connection.model(name, schema, collection);

            if (moduleOptions.forceCreateCollections) {
                // For transactional support the Models/Collections has exist in the 
                // tenant database, otherwise it will throw error
                await modelCreated.createCollection();
            }
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
                adapterHost: HttpAdapterHost,
            ) => this.getTenant(req, moduleOptions, adapterHost),
            inject: [
                REQUEST,
                TENANT_MODULE_OPTIONS,
                DEFAULT_HTTP_ADAPTER_HOST,
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

    /**
     * Create Http Adapter provider
     *
     * @private
     * @static
     * @returns {Provider}
     * @memberof TenancyCoreModule
     */
    private static createHttpAdapterProvider(): Provider {
        return {
            provide: DEFAULT_HTTP_ADAPTER_HOST,
            useFactory: (adapterHost: HttpAdapterHost) => adapterHost,
            inject: [
                HttpAdapterHost
            ],
        };
    }

    /**
     * Check if the object is empty or not
     *
     * @private
     * @param {*} obj
     * @returns
     * @memberof TenancyCoreModule
     */
    private static isEmpty(obj: any) {
        return !obj || !Object.keys(obj).some(x => obj[x] !== void 0);
    }

    /**
     * Check if the adapter is a fastify instance or not
     *
     * @private
     * @static
     * @param {HttpAdapterHost} adapterHost
     * @returns {boolean}
     * @memberof TenancyCoreModule
     */
    private static adapterIsFastify(adapterHost: HttpAdapterHost): boolean {
        return adapterHost.httpAdapter.getType() === 'fastify';
    }

    /**
     * Get the subdomains for fastify adaptor
     *
     * @private
     * @static
     * @param {Request} req
     * @returns {string[]}
     * @memberof TenancyCoreModule
     */
    private static getSubdomainsForFastify(req: Request): string[] {
        let host = req?.headers?.host || '';

        host = host.split(':')[0];
        host = host.trim();

        return host.split('.').reverse();
    }
}
