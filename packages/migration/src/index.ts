/**
 * @angple/migration
 *
 * 그누보드5 / 라이믹스(XE) → Angple 마이그레이션 도구
 */

export { analyzeGnuboard, migrateGnuboard } from './gnuboard/index.js';
export { analyzeRhymix, migrateRhymix } from './rhymix/index.js';
export { migratePassword, detectHashType, convertPhpBcryptHash } from './gnuboard/password-compat.js';
export { migrateAttachments, convertContentImagePaths } from './gnuboard/attachment-migrator.js';

export type {
    MigrationSource,
    DatabaseConfig,
    MigrationOptions,
    MigrationResult,
    MigrationProgress,
    MigrationPhase,
    MigrationAnalysis,
    MigrationStats,
    MigrationError,
    TableAnalysis
} from './types.js';

export { createEmptyStats } from './types.js';
