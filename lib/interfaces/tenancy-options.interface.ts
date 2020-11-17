import { ModuleMetadata, Type } from '@nestjs/common/interfaces';

/**
 * Options for synchronous setup
 *
 * @export
 * @interface TenancyModuleOptions
 */
export interface TenancyModuleOptions extends Record<string, any> {
    /**
     * If `true`, tenant id will be extracted from the subdomain
     */
    isTenantFromSubdomain?: boolean;
    
    /**
     * Tenant id will be extracted using the keyword from the request header
     */
    tenantIdentifier?: string;
    
    /**
     * URI for the tenant database
     */
    uri: (uri: string) => string;

    /**
     * Used for applying custom validations
     */
    validator?: (tenantId: string) => TenancyValidator;
    
    /**
     * Options for the database
     */
    options?: any;

    /**
     * Whitelist following subdomains
     */
    whitelist?: any;

    /**
     * Option to create the collections that are mapped to the tenant module
     * automatically while requesting for the tenant connection for the 
     * first time. This option is useful in case on mongo transactions, where
     * transactions doens't create a collection if it does't exist already.
     */
    forceCreateCollections?: boolean;
}

/**
 * For creating options dynamically
 * 
 * To use this the class implementing `TenancyOptionsFactory` should 
 * implement the method `createTenancyOptions` under it.
 *
 * @export
 * @interface TenancyOptionsFactory
 */
export interface TenancyOptionsFactory {
    createTenancyOptions():Promise<TenancyModuleOptions> | TenancyModuleOptions;
}

/**
 * Options for asynchronous setup
 *
 * @export
 * @interface TenancyModuleAsyncOptions
 */
export interface TenancyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<TenancyOptionsFactory>;
    useClass?: Type<TenancyOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<TenancyModuleOptions> | TenancyModuleOptions;
    inject?: any[];
}

/**
 * Tenancy validator interface
 * Note: The implementation controls the validation of the tenant
 * `validate` method will be called by the platform if valdation is set in the 
 * parent application.
 *
 * @export
 * @interface TenancyValidator
 */
export interface TenancyValidator {

    /**
     * Set the tenant id and return the instance of the class
     * Note: This is the method that should be called by the implementing
     * application
     *
     * @param {string} tenantId
     * @returns {TenancyValidator}
     * @memberof TenancyValidator
     */
    setTenantId(tenantId: string): TenancyValidator;

    /**
     * This call will be invoked internally by the library
     *
     * @memberof TenancyValidator
     */
    validate(): Promise<void>;
}