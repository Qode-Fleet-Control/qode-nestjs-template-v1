import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { VERSION_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { DEFAULT_API_VERSION, enabledApiVersions } from './api-versions';

// Nest's VersionValue (the shape of @Version/@Controller version metadata) is
// declared on an interface that @nestjs/common does not re-export, so mirror it.
type VersionValue =
  string | typeof VERSION_NEUTRAL | Array<string | typeof VERSION_NEUTRAL>;

// Global guard that 410s a request whose API version has been switched off via
// API_VERSIONS_ENABLED. By the time a guard runs the URI-versioned route has
// already matched, so the matched route's own version metadata IS the requested
// version — a version segment that never existed 404s in the router before we
// are reached, which keeps 404 (never existed) distinct from 410 (disabled).
@Injectable()
export class VersionGate implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const version = this.reflector.getAllAndOverride<VersionValue | undefined>(
      VERSION_METADATA,
      [context.getHandler(), context.getClass()],
    );

    // VERSION_NEUTRAL routes (e.g. /health) answer on every version and must
    // never be gated — let the fleet's readiness probe through untouched.
    const values = Array.isArray(version) ? version : [version];
    if (values.includes(VERSION_NEUTRAL)) {
      return true;
    }

    const enabled = enabledApiVersions();
    for (const value of values) {
      // Any remaining symbol is VERSION_NEUTRAL, already exempted above.
      if (typeof value === 'symbol') {
        continue;
      }
      // An unversioned route resolves to the configured defaultVersion.
      const resolved = value === undefined ? DEFAULT_API_VERSION : value;
      if (!enabled.has(resolved)) {
        throw new GoneException(`API v${resolved} is disabled`);
      }
    }
    return true;
  }
}
