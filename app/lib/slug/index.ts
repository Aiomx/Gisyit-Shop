/**
 * Slug Module
 *
 * Exports for slug generation, validation, and lookup utilities.
 */

export {
    generateSlug,
    validateSlug,
    isReservedSlug,
    RESERVED_SLUGS,
    type SlugValidationResult,
    type ReservedSlug,
} from './slug';

// Note: Server-side exports are in separate files:
// - slug-lookup.server.ts: Slug lookup operations
//   import { lookupBySlugOrId, isSlugAvailable, generateUniqueSlug } from '~/lib/slug/slug-lookup.server';
// - slug-history.server.ts: Slug history operations
//   import { recordSlugChange, lookupByHistoricalSlug, removeFromHistory, getSlugHistory } from '~/lib/slug/slug-history.server';
// - slug-migration.server.ts: Migration utilities for existing products
//   import { runSlugMigration, verifyMigrationComplete, getMigrationStats } from '~/lib/slug/slug-migration.server';
