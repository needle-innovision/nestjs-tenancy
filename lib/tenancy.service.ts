import { Inject, Injectable, Type } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { TenancyModuleOptions } from './interfaces';
import { TENANT_MODULE_OPTIONS } from './tenancy.constants';

@Injectable()
export class TenancyService {
  constructor(
    private moduleRef: ModuleRef,
    @Inject(TENANT_MODULE_OPTIONS) private options: TenancyModuleOptions,
  ) {}

  /**
   * Run a callback within a tenant-scoped context.
   * Creates a NestJS request scope so all REQUEST-scoped providers
   * (TENANT_CONTEXT, TENANT_CONNECTION, models) resolve correctly.
   *
   * Simple overload - resolve a single service:
   * ```ts
   * await tenancy.run(tenantId, NotificationService, async (svc) => {
   *   await svc.send(payload);
   * });
   * ```
   */
  async run<T, R = void>(
    tenantId: string,
    serviceType: Type<T>,
    fn: (service: T) => Promise<R>,
  ): Promise<R>;

  /**
   * Run a callback within a tenant-scoped context.
   * Creates a NestJS request scope so all REQUEST-scoped providers
   * (TENANT_CONTEXT, TENANT_CONNECTION, models) resolve correctly.
   *
   * Flexible overload - resolve multiple services:
   * ```ts
   * await tenancy.run(tenantId, async (resolve) => {
   *   const a = await resolve(NotificationService);
   *   const b = await resolve(UserService);
   *   await a.send(payload);
   * });
   * ```
   */
  async run<R = void>(
    tenantId: string,
    fn: (resolve: <S>(type: Type<S>) => Promise<S>) => Promise<R>,
  ): Promise<R>;

  async run<T, R = void>(
    tenantId: string,
    serviceTypeOrFn:
      | Type<T>
      | ((resolve: <S>(type: Type<S>) => Promise<S>) => Promise<R>),
    fn?: (service: T) => Promise<R>,
  ): Promise<R> {
    const contextId = ContextIdFactory.create();

    // Build a fake request that carries the tenant identifier.
    // TENANT_CONTEXT provider will extract the tenant from this object
    // using req.headers (the fallback path we added in 3.0.10).
    const request = this.buildRequest(tenantId);
    this.moduleRef.registerRequestByContextId(request, contextId);

    const resolver = <S>(type: Type<S>): Promise<S> =>
      this.moduleRef.resolve(type, contextId, { strict: false });

    if (fn) {
      // Overload 1: serviceTypeOrFn is a Type<T>, fn is the callback
      const service = await resolver(serviceTypeOrFn as Type<T>);
      return fn(service);
    } else {
      // Overload 2: serviceTypeOrFn is the callback with resolver
      return (
        serviceTypeOrFn as (
          resolve: <S>(type: Type<S>) => Promise<S>,
        ) => Promise<R>
      )(resolver);
    }
  }

  private buildRequest(tenantId: string): Record<string, any> {
    if (this.options.isTenantFromSubdomain) {
      return {
        headers: { host: `${tenantId}.tenancy.local` },
        subdomains: [tenantId],
      };
    }

    const identifier = (this.options.tenantIdentifier || '').toLowerCase();
    return {
      headers: { [identifier]: tenantId },
    };
  }
}
