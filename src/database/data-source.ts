import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

// Single source of truth for the TypeORM connection. Both the NestJS
// TypeOrmModule (see app.module.ts) and the TypeORM CLI (migration:run /
// migration:generate) read these options, so runtime and migrations can never
// point at different schemas.
//
// The connection string is injected by the fleet as DATABASE_URL and must never
// be hardcoded. synchronize is OFF everywhere — schema changes go through
// migrations only.
//
// The entity/migration globs match both compiled `.js` (production, running
// from dist/) and `.ts` (local generate via ts-node), so the same file works in
// both contexts without branching on NODE_ENV.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '..', '**', '*.entity.{js,ts}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{js,ts}')],
  synchronize: false,
  logging: false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
