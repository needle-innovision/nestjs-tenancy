import { Request } from 'express';

export interface TenancyRequest extends Request {
    tenantId?: string;
}
