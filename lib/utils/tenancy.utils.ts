import { DEFAULT_TENANT_DB_CONNECTION } from '../tenancy.constants';

/**
 * Get tenant model name formatted
 *
 * @export
 * @param {string} model
 * @returns
 */
export function getTenantModelToken(model: string) {
    return `${model}Model`;
}

/**
 * Get tenant model definition name
 *
 * @export
 * @param {string} model
 * @returns
 */
export function getTenantModelDefinitionToken(model: string) {
    return `${model}Definition`;
}

/**
 * Get the connecion token name formatted
 *
 * @export
 * @param {string} [name]
 * @returns
 */
export function getTenantConnectionToken(name?: string) {
    return name && name !== DEFAULT_TENANT_DB_CONNECTION
        ? `${name}TenantConnection`
        : DEFAULT_TENANT_DB_CONNECTION;
}
