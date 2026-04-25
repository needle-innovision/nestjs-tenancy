import {
  BadRequestException,
  DynamicModule,
  Global,
  Module,
  OnApplicationShutdown,
  Provider,
  Scope,
} from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { HttpAdapterHost, REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Connection, createConnection, Model } from 'mongoose';
import { ConnectionOptions } from 'tls';
import {
  TenancyModuleAsyncOptions,
  TenancyModuleOptions,
  TenancyOptionsFactory,
} from './interfaces';
import {
  BASE_CONNECTION_MAP,
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
  // Track pending base connections to prevent race conditions
  private static pendingConnections: Map<string, Promise<Connection>> =
    new Map();
  // Track pending tenant connections to prevent race conditions
  private static pendingTenantConnections: Map<string, Promise<Connection>> =
    new Map();
  // Track which connections have handlers set up to prevent duplicates
  private static connectionsWithHandlers: Set<string> = new Set();
  // Store base connection map for cleanup on shutdown
  private static baseConnectionMapInstance: ConnectionMap | null = null;

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

    /* Base Connection Map */
    const baseConnectionMapProvider = this.createBaseConnectionMapProvider();

    /* Tenant Connection */
    const tenantConnectionProvider =
      this.createTenantConnectionProvider();

    const providers = [
      tenancyModuleOptionsProvider,
      tenantContextProvider,
      connectionMapProvider,
      modelDefinitionMapProvider,
      baseConnectionMapProvider,
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

    /* Base Connection Map */
    const baseConnectionMapProvider = this.createBaseConnectionMapProvider();

    /* Tenant Connection */
    const tenantConnectionProvider =
      this.createTenantConnectionProvider();

    /* Asyc providers */
    const asyncProviders = this.createAsyncProviders(options);

    const providers = [
      ...asyncProviders,
      tenantContextProvider,
      connectionMapProvider,
      modelDefinitionMapProvider,
      baseConnectionMapProvider,
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
    // Close all base connections (tenant connections are derived from them)
    if (TenancyCoreModule.baseConnectionMapInstance) {
      await Promise.all(
        [...TenancyCoreModule.baseConnectionMapInstance.values()].map(
          (connection) => connection.close(),
        ),
      );
    }
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
    const { tenantIdentifier = null, isTenantFromSubdomain = false } =
      moduleOptions;

    // Pull the tenant id from the subdomain
    if (isTenantFromSubdomain) {
      return this.getTenantFromSubdomain(isFastifyAdaptor, req);
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
   * @param {ConnectionMap} baseConnMap
   * @param {ConnectionMap} connMap
   * @param {ModelDefinitionMap} modelDefMap
   * @returns {Promise<Connection>}
   * @memberof TenancyCoreModule
   */
  private static async getConnection(
    tenantId: string,
    moduleOptions: TenancyModuleOptions,
    baseConnMap: ConnectionMap,
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

      // Only re-register models if new definitions were added since this
      // connection was cached (e.g. lazy-loaded feature modules).
      // The model provider factory also has a fallback, so this is belt-and-suspenders.
      const registeredCount = Object.keys(connection.models).length;
      if (registeredCount < modelDefMap.size) {
        modelDefMap.forEach((definition: any) => {
          const { name, schema, collection } = definition;
          if (!connection.models[name]) {
            connection.model(name, schema, collection);
          }
        });
      }

      if (moduleOptions.forceCreateCollections) {
        // For transactional support the Models/Collections has exist in the
        // tenant database, otherwise it will throw error
        await Promise.all(
          Object.entries(connection.models).map(([, m]) =>
            m.createCollection(),
          ),
        );
      }

      return connection;
    }

    // Check if another request is already creating this tenant's connection
    const pendingTenantConn = this.pendingTenantConnections.get(tenantId);
    if (pendingTenantConn) {
      return await pendingTenantConn;
    }

    // Create the tenant connection and track it as pending
    const tenantConnectionPromise = this.createTenantConnection(
      tenantId,
      moduleOptions,
      baseConnMap,
      connMap,
      modelDefMap,
    );
    this.pendingTenantConnections.set(tenantId, tenantConnectionPromise);

    try {
      return await tenantConnectionPromise;
    } finally {
      this.pendingTenantConnections.delete(tenantId);
    }
  }

  /**
   * Create a new tenant connection (resolve URI, get base connection, useDb)
   *
   * @private
   * @static
   * @param {string} tenantId
   * @param {TenancyModuleOptions} moduleOptions
   * @param {ConnectionMap} baseConnMap
   * @param {ConnectionMap} connMap
   * @param {ModelDefinitionMap} modelDefMap
   * @returns {Promise<Connection>}
   * @memberof TenancyCoreModule
   */
  private static async createTenantConnection(
    tenantId: string,
    moduleOptions: TenancyModuleOptions,
    baseConnMap: ConnectionMap,
    connMap: ConnectionMap,
    modelDefMap: ModelDefinitionMap,
  ): Promise<Connection> {
    // Get the full URI for this tenant
    const uri = await Promise.resolve(moduleOptions.uri(tenantId));

    // Extract the base URI (cluster) and database name
    const baseUri = this.extractBaseUri(uri);
    const dbName = this.extractDatabaseName(uri, tenantId);

    // Get or create a base connection for this cluster
    let baseConnection = baseConnMap.get(baseUri);
    const needsReconnection =
      baseConnection &&
      (baseConnection.readyState === 0 ||
        baseConnection.readyState === 3 ||
        baseConnection.readyState === 99);

    if (!baseConnection || needsReconnection) {
      // Check if another request is already creating this connection
      const pendingConnection = this.pendingConnections.get(baseUri);
      if (pendingConnection) {
        // Wait for the other request to finish creating the connection
        baseConnection = await pendingConnection;
      } else {
        // Create the connection and track it as pending
        const connectionPromise = this.createBaseConnection(
          uri,
          baseUri,
          moduleOptions,
          baseConnMap,
          connMap,
          needsReconnection,
        );
        this.pendingConnections.set(baseUri, connectionPromise);

        try {
          baseConnection = await connectionPromise;
        } finally {
          // Remove from pending once complete
          this.pendingConnections.delete(baseUri);
        }
      }
    }

    // Use the base connection to switch to the tenant's database
    // This reuses the connection pool for the cluster
    const connection = baseConnection.useDb(dbName);

    // Attach connection to the models passed in the map
    const modelPromises: Promise<void>[] = [];
    modelDefMap.forEach((definition: any) => {
      const { name, schema, collection } = definition;

      const modelCreated = connection.model(name, schema, collection);

      if (moduleOptions.forceCreateCollections) {
        modelPromises.push(modelCreated.createCollection());
      }
    });

    // Wait for all collections to be created
    if (modelPromises.length > 0) {
      await Promise.all(modelPromises);
    }

    // Add the new connection to the map
    connMap.set(tenantId, connection);

    return connection;
  }

  /**
   * Create a new base connection for a cluster
   *
   * @private
   * @static
   * @param {string} uri
   * @param {string} baseUri
   * @param {TenancyModuleOptions} moduleOptions
   * @param {ConnectionMap} baseConnMap
   * @param {ConnectionMap} connMap
   * @param {boolean} isReconnection
   * @returns {Promise<Connection>}
   * @memberof TenancyCoreModule
   */
  private static async createBaseConnection(
    uri: string,
    baseUri: string,
    moduleOptions: TenancyModuleOptions,
    baseConnMap: ConnectionMap,
    connMap: ConnectionMap,
    isReconnection: boolean,
  ): Promise<Connection> {
    if (isReconnection) {
      // Connection exists but is disconnected
      const oldConnection = baseConnMap.get(baseUri);
      if (oldConnection) {
        // Clean up old connection
        try {
          await oldConnection.close();
        } catch (error) {
          // Ignore errors when closing dead connection
        }
      }
      // Clear tenant connections for this cluster
      this.clearTenantConnectionsForCluster(connMap, baseUri);
      // Clear handler tracking for old connection
      this.connectionsWithHandlers.delete(baseUri);
    }

    // Create a new base connection for this cluster
    const connectionOptions: ConnectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...moduleOptions.options(),
    };

    // For the base connection, connect without a specific database
    // or use 'admin' database if authentication is required
    const baseConnectionUri = this.buildBaseConnectionUri(uri, baseUri);
    const baseConnection = createConnection(
      baseConnectionUri,
      connectionOptions,
    );
    baseConnMap.set(baseUri, baseConnection);

    // Set up automatic reconnection handlers (only once per connection)
    if (!this.connectionsWithHandlers.has(baseUri)) {
      this.setupConnectionHandlers(
        baseConnection,
        baseUri,
        connMap,
        baseConnMap,
      );
      this.connectionsWithHandlers.add(baseUri);
    }

    // Wait for the connection to be ready
    await new Promise<void>((resolve, reject) => {
      if (baseConnection.readyState === 1) {
        resolve();
      } else {
        baseConnection.once('open', () => resolve());
        baseConnection.once('error', reject);
      }
    });

    return baseConnection;
  }

  /**
   * Setup connection event handlers for transparent reconnection
   *
   * @private
   * @static
   * @param {Connection} connection
   * @param {string} baseUri
   * @param {ConnectionMap} connMap
   * @param {ConnectionMap} baseConnMap
   * @memberof TenancyCoreModule
   */
  private static setupConnectionHandlers(
    connection: Connection,
    baseUri: string,
    connMap: ConnectionMap,
    baseConnMap: ConnectionMap,
  ): void {
    // Handle disconnection events
    connection.on('disconnected', () => {
      try {
        console.warn(
          `[TenancyModule] Base connection disconnected for cluster: ${baseUri}`,
        );
        // Clear tenant connections so they get recreated on next request
        this.clearTenantConnectionsForCluster(connMap, baseUri);
        // Mark handlers as needing to be re-setup on reconnection
        this.connectionsWithHandlers.delete(baseUri);
      } catch (error) {
        console.error(
          `[TenancyModule] Error handling disconnection for cluster: ${baseUri}`,
          error,
        );
      }
    });

    // Handle reconnection events
    connection.on('reconnected', () => {
      console.log(
        `[TenancyModule] Base connection reconnected for cluster: ${baseUri}`,
      );
    });

    // Handle connection errors
    connection.on('error', (error) => {
      console.error(
        `[TenancyModule] Base connection error for cluster: ${baseUri}`,
        error.message,
      );
    });

    // Handle connection close
    connection.on('close', () => {
      try {
        console.warn(
          `[TenancyModule] Base connection closed for cluster: ${baseUri}`,
        );
        // Remove from base connection map
        baseConnMap.delete(baseUri);
        this.connectionsWithHandlers.delete(baseUri);
      } catch (error) {
        console.error(
          `[TenancyModule] Error handling close for cluster: ${baseUri}`,
          error,
        );
      }
    });
  }

  /**
   * Clear tenant connections for a specific cluster
   *
   * @private
   * @static
   * @param {ConnectionMap} connMap
   * @param {string} baseUri
   * @memberof TenancyCoreModule
   */
  private static clearTenantConnectionsForCluster(
    connMap: ConnectionMap,
    baseUri: string,
  ): void {
    try {
      // Extract host from baseUri for matching
      const baseHostMatch = baseUri.match(/:\/\/([^@]*@)?([^/]+)/);
      const baseHost = baseHostMatch ? baseHostMatch[2] : null;

      // Find and remove all tenant connections that belong to this cluster
      const keysToDelete: string[] = [];
      connMap.forEach((connection, tenantId) => {
        try {
          // Check if this tenant connection belongs to the disconnected cluster
          const connHost = connection.host;

          // Match if hosts are the same or if connection host is part of base URI
          if (
            (baseHost && connHost && connHost === baseHost) ||
            (connHost && baseUri.includes(connHost))
          ) {
            keysToDelete.push(tenantId);
          }
        } catch (error) {
          // If we can't determine, keep the connection (safer than removing)
          console.warn(
            `[TenancyModule] Could not check connection host for tenant: ${tenantId}`,
          );
        }
      });

      // Remove the stale connections
      keysToDelete.forEach((key) => connMap.delete(key));

      if (keysToDelete.length > 0) {
        console.log(
          `[TenancyModule] Cleared ${keysToDelete.length} tenant connection(s) for cluster`,
        );
      }
    } catch (error) {
      console.error(
        `[TenancyModule] Error clearing tenant connections for cluster: ${baseUri}`,
        error,
      );
    }
  }

  /**
   * Create base connection map provider
   *
   * @private
   * @static
   * @returns {Provider}
   * @memberof TenancyCoreModule
   */
  private static createBaseConnectionMapProvider(): Provider {
    return {
      provide: BASE_CONNECTION_MAP,
      useFactory: (): ConnectionMap => {
        // Create and store the map instance for shutdown cleanup
        const map = new Map();
        TenancyCoreModule.baseConnectionMapInstance = map;
        return map;
      },
    };
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
   * Create tenant connection provider
   *
   * @private
   * @static
   * @returns {Provider}
   * @memberof TenancyCoreModule
   */
  private static createTenantConnectionProvider(): Provider {
    return {
      provide: TENANT_CONNECTION,
      scope: Scope.REQUEST,
      useFactory: async (
        tenantId: string,
        moduleOptions: TenancyModuleOptions,
        baseConnMap: ConnectionMap,
        connMap: ConnectionMap,
        modelDefMap: ModelDefinitionMap,
      ): Promise<Connection> => {
        return await this.getConnection(
          tenantId,
          moduleOptions,
          baseConnMap,
          connMap,
          modelDefMap,
        );
      },
      inject: [
        TENANT_CONTEXT,
        TENANT_MODULE_OPTIONS,
        BASE_CONNECTION_MAP,
        CONNECTION_MAP,
        MODEL_DEFINITION_MAP,
      ],
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
        req: Request,
        moduleOptions: TenancyModuleOptions,
        adapterHost: HttpAdapterHost,
      ) => this.getTenant(req, moduleOptions, adapterHost),
      inject: [REQUEST, TENANT_MODULE_OPTIONS, DEFAULT_HTTP_ADAPTER_HOST],
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
   * Build base connection URI for cluster
   *
   * @private
   * @static
   * @param {string} fullUri
   * @param {string} baseUri
   * @returns {string}
   * @memberof TenancyCoreModule
   */
  private static buildBaseConnectionUri(
    fullUri: string,
    baseUri: string,
  ): string {
    try {
      // Extract query parameters (including auth source) from original URI
      const queryMatch = fullUri.match(/\?(.+)$/);
      const queryParams = queryMatch ? `?${queryMatch[1]}` : '';

      // Check if authSource is already specified in query parameters
      const hasAuthSource = queryParams.includes('authSource=');

      if (hasAuthSource) {
        // authSource is already in query params, no need to add database to path
        // Just use base URI with the query parameters
        return `${baseUri}${queryParams}`;
      }

      // Check if the original URI has authentication in the connection string
      const hasAuth = fullUri.match(/:\/\/([^@]+)@/);

      if (hasAuth) {
        // Authentication present but no authSource in query params
        // Connect to admin database by default for authentication
        return `${baseUri}/admin${queryParams}`;
      }

      // No authentication, just use base URI with query params
      return `${baseUri}${queryParams}`;
    } catch (error) {
      // Fallback to base URI
      return baseUri;
    }
  }

  /**
   * Extract base URI (cluster URL without database name) from MongoDB URI
   *
   * @private
   * @static
   * @param {string} uri
   * @returns {string}
   * @memberof TenancyCoreModule
   */
  private static extractBaseUri(uri: string): string {
    try {
      // Remove the database name from the URI to get the base cluster URI
      // Format: mongodb://host:port/dbname -> mongodb://host:port
      // Format: mongodb+srv://host/dbname?options -> mongodb+srv://host?options
      const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (error) {
      // If extraction fails, return the full URI as fallback
    }
    return uri;
  }

  /**
   * Extract database name from MongoDB URI
   *
   * @private
   * @static
   * @param {string} uri
   * @param {string} tenantId
   * @returns {string}
   * @memberof TenancyCoreModule
   */
  private static extractDatabaseName(uri: string, tenantId: string): string {
    try {
      // Try to extract database name from URI
      // Format: mongodb://host:port/dbname or mongodb+srv://host/dbname
      const match = uri.match(/\/([^/?]+)(\?|$)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (error) {
      // If extraction fails, fall back to tenant ID
    }

    // Default to using tenant ID as database name
    return tenantId;
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
