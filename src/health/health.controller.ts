import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

// VERSION_NEUTRAL keeps /health answering regardless of the default version, so
// it stays at plain /health (it is also excluded from the global prefix).
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  // GET /health — 200 only when the database answers a ping, so the fleet's
  // readiness probe reflects DB reachability, not just process liveness.
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
