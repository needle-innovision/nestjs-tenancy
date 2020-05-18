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
     * Options for the database
     */
    options?: any;

    /**
     * Whitelist following subdomains
     */
    whitelist?: any;
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