import {
  BadRequestException,
  DynamicModule, 
  Global,
  Module,
  OnApplicationShutdown,
  Provider, 
  Scope,
  ExecutionContext,
} from '@nestjs/common';
import {  Type } from '@nestjs/common/interfaces'; 
import { HttpAdapterHost, ModuleRef, REQUEST } from '@nestjs/core'; 
import { BaseRpcContext, CONTEXT, RequestContext, RpcException, TcpContext } from '@nestjs/microservices';
import { Request } from 'express';
import { Connection, createConnection, Model } from 'mongoose';
import { ConnectionOptions } from 'tls';
import {
  TenancyModuleAsyncOptions,
  TenancyModuleOptions,
  TenancyOptionsFactory,
} from './interfaces';
import {
  CONNECTION_MAP,
  DEFAULT_HTTP_ADAPTER_HOST,
  MODEL_DEFINITION_MAP,
  TENANT_CONNECTION,
  TENANT_CONTEXT,
  TENANT_MODULE_OPTIONS,
} from './tenancy.constants';
import { ConnectionMap, ModelDefinitionMap } from './types';

@Global()
@Module({})
export class TenancyCoreModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

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
        return await this.getConnection(
          tenantId,
          moduleOptions,
          connMap,
          modelDefMap,
        );
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
        return await this.getConnection(
          tenantId,
          moduleOptions,
          connMap,
          modelDefMap,
        );
      },
      inject: [
        TENANT_CONTEXT,
        TENANT_MODULE_OPTIONS,
        CONNECTION_MAP,
        MODEL_DEFINITION_MAP,
      ],
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
      exports: providers,
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
      [...connectionMap.values()].map((connection) => connection.close()),
    );
  }

  /**
   * Get Tenant id from the request
   *
   * @private
   * @static
   * @param {ExecutionContext & Request} context
   * @param {TenancyModuleOptions} moduleOptions
   * @param {HttpAdapterHost} adapterHost
   * @returns {string}
   * @memberof TenancyCoreModule
   */
  private static getTenant(
    requestContext: RequestContext & Request,
    moduleOptions: TenancyModuleOptions,
    adapterHost: HttpAdapterHost,
  ): string {

    if (!moduleOptions) {
      throw new BadRequestException(`Tenant options are mandatory`);
    }
    // Extract the tenant idetifier
    const { tenantIdentifier = null, isTenantFromSubdomain = false } = moduleOptions;
    

    // when the call is a microservice call then the context is one of the possible contexts eg TcpContext, RmqContext etc..
    // when the call is an http call then the requestContext is Request object... (something to do with injection from above)
   
    var data: any;
    var contextType = 'http'; // default
    var context = typeof requestContext.pattern !== 'undefined' ? requestContext.getContext() : requestContext; // bad check could be better
    if(typeof requestContext.pattern !== 'undefined') {
      //console.log('getTenant requestContext', requestContext); 

      //console.log('context', context);
      contextType = 'rpc'; //context.getType(); // get Type not working here.. dont know why
      data = requestContext.data;
    } 


   
     // Validate if tenant identifier token is present
    if (!tenantIdentifier) {
      throw new BadRequestException(`Tenant identifier is mandatory`);
    }


    if(contextType === 'http') {
      //  do something that is only important in the context of regular HTTP requests (REST)
      var req = context;
      if(typeof context.switchToHttp !== 'undefined') {
         req = context.getRequest();
      }
      // Check if the adaptor is fastify
      const isFastifyAdaptor = this.adapterIsFastify(adapterHost);

      // Pull the tenant id from the subdomain
      if (isTenantFromSubdomain) {
        return this.getTenantFromSubdomain(isFastifyAdaptor, req);
      } else { 
        return this.getTenantFromRequest(isFastifyAdaptor, req, tenantIdentifier);
      }

     } else if(contextType === 'rpc') {
        // do something that is only important in the context of Microservice requests
 
        // inside microservice call..
        // just return a property from the sent data object -- could be dynamic using tenantIdentifier
     
        return this.getTenantFromMicroserviceRequest(data, tenantIdentifier);
   
    } else if(contextType === 'ws') {
        // do something that is only important in the context of Websocket requests
 
        return this.getTenantFromWebsocketRequest(data, tenantIdentifier);
    }

    return '';

  }


  
  
    /**
   * Get the Tenant information from the request object
   *
   * @private
   * @static 
   * @param {RmqData} data
   * @param {string} tenantIdentifier
   * @returns
   * @memberof TenancyCoreModule
   */
     private static getTenantFromWebsocketRequest( 
      data: any,
      tenantIdentifier: string,
    ): string {
      // could be extended later
      
      let tenantId = data[tenantIdentifier]; 
  
      // Validate if tenant id is present
      if (this.isEmpty(tenantId)) {
        throw new RpcException(`${tenantIdentifier} is not supplied`);
      }
  
      return tenantId;
    }

  /**
   * Get the Tenant information from the request object
   *
   * @private
   * @static 
   * @param {RmqData} data
   * @param {string} tenantIdentifier
   * @returns
   * @memberof TenancyCoreModule
   */
   private static getTenantFromMicroserviceRequest( 
    data: any,
    tenantIdentifier: string,
  ): string {

    // could be extended later
      
    let tenantId = data[tenantIdentifier]; 

    // Validate if tenant id is present
    if (this.isEmpty(tenantId)) {
      throw new RpcException(`${tenantIdentifier} is not supplied`);
    }

    return tenantId;
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
  private static getTenantFromRequest(
    isFastifyAdaptor: boolean,
    req: Request,
    tenantIdentifier: string,
  ) {

    let tenantId = '';
   
    if (isFastifyAdaptor) {
      // For Fastify
      // Get the tenant id from the header
      tenantId =
        req.headers[`${tenantIdentifier || ''}`.toLowerCase()]?.toString() ||
        '';
    } else {
      // For Express - Default
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
   * Get the Tenant information from the request header
   *
   * @private
   * @static
   * @param {boolean} isFastifyAdaptor
   * @param {Request} req
   * @returns
   * @memberof TenancyCoreModule
   */
  private static getTenantFromSubdomain(
    isFastifyAdaptor: boolean,
    req: Request,
  ) {
    let tenantId = '';

    if (isFastifyAdaptor) {
      // For Fastify
      const subdomains = this.getSubdomainsForFastify(req);

      if (subdomains instanceof Array && subdomains.length > 0) {
        tenantId = subdomains[subdomains.length - 1];
      }
    } else {
      // For Express - Default
      // Check for multi-level subdomains and return only the first name
      if (req.subdomains instanceof Array && req.subdomains.length > 0) {
        tenantId = req.subdomains[req.subdomains.length - 1];
      }
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
          Object.entries(connection.models).map(([k, m]) =>
            m.createCollection(),
          ),
        );
      }

      return connection;
    }

    // Otherwise create a new connection
    const uri = await Promise.resolve(moduleOptions.uri(tenantId));
    // Connection options
    const connectionOptions: ConnectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...moduleOptions.options(),
    };

    // Create the connection
    const connection = createConnection(uri, connectionOptions);

    // Attach connection to the models passed in the map
    modelDefMap.forEach(async (definition: any) => {
      const { name, schema, collection } = definition;

      const modelCreated: Model<unknown> = connection.model(
        name,
        schema,
        collection,
      );

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
    };
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
    };
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
        context: RequestContext & Request, 
        moduleOptions: TenancyModuleOptions,
        adapterHost: HttpAdapterHost,
      ) => this.getTenant(context, moduleOptions, adapterHost),
      inject: [CONTEXT, TENANT_MODULE_OPTIONS, DEFAULT_HTTP_ADAPTER_HOST],
    };
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
    if (options.useFactory) {
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
      inject: [HttpAdapterHost],
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
    return !obj || !Object.keys(obj).some((x) => obj[x] !== void 0);
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
