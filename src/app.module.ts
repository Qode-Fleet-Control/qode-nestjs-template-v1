import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/data-source';
import { HealthModule } from './health/health.module';
import { ItemsModule } from './items/items.module';
import { VersionGate } from './common/version-gate.guard';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => dataSourceOptions,
    }),
    HealthModule,
    ItemsModule,
  ],
  providers: [
    // Global guard that 410s requests for a version disabled via
    // API_VERSIONS_ENABLED; VERSION_NEUTRAL routes (/health) are exempt.
    { provide: APP_GUARD, useClass: VersionGate },
  ],
})
export class AppModule {}
