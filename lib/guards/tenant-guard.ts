import { BadRequestException, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

export class TenantGuard implements CanActivate {
    constructor(private readonly needsTenant = true) {}

    public canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        if (this.needsTenant && !request.tenantId) {
            throw new BadRequestException('Tenant ID is mandatory');
        }

        return true;
    }
}
