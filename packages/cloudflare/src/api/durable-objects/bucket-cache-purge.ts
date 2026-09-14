import { DurableObject } from "cloudflare:workers";

import { internalPurgeCacheByTags, parseZoneIds } from "../overrides/internal.js";

const DEFAULT_BUFFER_TIME_IN_SECONDS = 5;
// https://developers.cloudflare.com/cache/how-to/purge-cache/#hostname-tag-prefix-url-and-purge-everything-limits
const MAX_NUMBER_OF_TAGS_PER_PURGE = 100;

export class BucketCachePurge extends DurableObject<CloudflareEnv> {
	bufferTimeInSeconds: number;

	constructor(state: DurableObjectState, env: CloudflareEnv) {
		super(state, env);
		this.bufferTimeInSeconds = env.NEXT_CACHE_DO_PURGE_BUFFER_TIME_IN_SECONDS
			? parseInt(env.NEXT_CACHE_DO_PURGE_BUFFER_TIME_IN_SECONDS)
			: DEFAULT_BUFFER_TIME_IN_SECONDS; // Default buffer time

		// Initialize tables if they don't exist
		state.blockConcurrencyWhile(async () => {
			state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS cache_purge (
        tag TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tag_index ON cache_purge (tag);
      CREATE TABLE IF NOT EXISTS pending_zones (
        zone_id TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS zone_index ON pending_zones (zone_id);
      `);
		});
	}

	async purgeCacheByTags(tags: string[]) {
		for (const tag of tags) {
			// Insert the tag into the sql table
			this.ctx.storage.sql.exec(
				`
        INSERT OR REPLACE INTO cache_purge (tag)
        VALUES (?)`,
				tag
			);
		}
		const nextAlarm = await this.ctx.storage.getAlarm();
		if (!nextAlarm) {
			// Set an alarm to trigger the cache purge
			this.ctx.storage.setAlarm(Date.now() + this.bufferTimeInSeconds * 1000);
		}
	}

	override async alarm() {
		let tags = this.ctx.storage.sql
			.exec<{ tag: string }>(
				`
      SELECT * FROM cache_purge LIMIT ${MAX_NUMBER_OF_TAGS_PER_PURGE}
    `
			)
			.toArray();
		do {
			if (tags.length === 0) {
				// No tags to purge, we can stop
				return;
			}

			// Check whether a previous alarm attempt left rate-limited zones.
			// If so, only retry those zones instead of all configured zones.
			const pendingZones = this.ctx.storage.sql
				.exec<{ zone_id: string }>(`SELECT * FROM pending_zones`)
				.toArray()
				.map((row) => row.zone_id);

			const zoneIds = pendingZones.length > 0 ? pendingZones : parseZoneIds(this.env);

			const result = await internalPurgeCacheByTags(
				this.env,
				tags.map((row) => row.tag),
				zoneIds
			);

			// For every other error, we just remove the tags from the sql table
			// and continue
			if (result.status === "rate-limit-exceeded") {
				// Persist only the rate-limited zones so the retry skips zones
				// that already succeeded.
				this.ctx.storage.sql.exec(`DELETE FROM pending_zones`);
				for (const zoneId of result.rateLimitedZones) {
					this.ctx.storage.sql.exec(`INSERT OR REPLACE INTO pending_zones (zone_id) VALUES (?)`, zoneId);
				}
				// Rate limit exceeded, we need to wait for the next alarm
				// and try again
				// We throw here to take advantage of the built-in retry
				throw new Error("Rate limit exceeded");
			}

			// Purge succeeded, clear pending zones.
			this.ctx.storage.sql.exec(`DELETE FROM pending_zones`);

			// Delete the tags from the sql table
			this.ctx.storage.sql.exec(
				`
        DELETE FROM cache_purge
        WHERE tag IN (${tags.map(() => "?").join(",")})
      `,
				...tags.map((row) => row.tag)
			);
			if (tags.length < MAX_NUMBER_OF_TAGS_PER_PURGE) {
				// If we have less than MAX_NUMBER_OF_TAGS_PER_PURGE tags, we can stop
				tags = [];
			} else {
				// Otherwise, we need to get the next 100 tags
				tags = this.ctx.storage.sql
					.exec<{ tag: string }>(
						`
          SELECT * FROM cache_purge LIMIT ${MAX_NUMBER_OF_TAGS_PER_PURGE}
        `
					)
					.toArray();
			}
		} while (tags.length > 0);
	}
}
