import { Inject } from '@nestjs/common';
import { getTenantConnectionToken, getTenantModelToken } from '../utils';

/**
 * Get the instance of the tenant model object
 *
 * @param model any
 */
export const InjectTenancyModel = (model: string) => Inject(getTenantModelToken(model));

/**
 * Get the instance of the tenant connection
 *
 * @param name any
 */
export const InjectTenancyConnection = (name?: string) => Inject(getTenantConnectionToken(name));
