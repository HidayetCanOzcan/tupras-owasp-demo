import Redis from "ioredis";

type RedisResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

export type RedisConfig = {
	url?: string;
	host?: string;
	port?: number;
};

const assertRedisConfig = (config: RedisConfig) => {
	if (!config) {
		throw new Error("Redis config must be provided.");
	}

	const hasUrl = Boolean(config.url);
	const hasHostPort = Boolean(config.host) && typeof config.port === "number";

	if (!hasUrl && !hasHostPort) {
		throw new Error("Redis config requires either url or host and port.");
	}
};

export class RedisManager {
	private static instance: RedisManager | null = null;
	private client: Redis;

	constructor(config?: RedisConfig) {
		if (RedisManager.instance) {
			this.client = RedisManager.instance.client;
			return;
		}

		if (!config) {
			throw new Error(
				"Redis config must be provided for first initialization.",
			);
		}

		assertRedisConfig(config);

		if (config.url) {
			this.client = new Redis(config.url);
		} else {
			this.client = new Redis({
				host: config.host,
				port: config.port,
			});
		}

		RedisManager.instance = this;
	}

	async create<T>(
		key: string,
		value: T,
		ttlSeconds?: number,
	): Promise<RedisResult<"OK">> {
		try {
			const result = ttlSeconds
				? await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds)
				: await this.client.set(key, JSON.stringify(value));
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async read<T>(key: string): Promise<RedisResult<T | null>> {
		try {
			const raw = await this.client.get(key);
			return {
				success: true,
				data: raw ? (JSON.parse(raw) as T) : null,
			};
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async update<T>(
		key: string,
		value: T,
		preserveTtl = true,
	): Promise<RedisResult<"OK">> {
		try {
			const result = preserveTtl
				? await this.client.set(key, JSON.stringify(value), "KEEPTTL")
				: await this.client.set(key, JSON.stringify(value));
			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async remove(key: string): Promise<RedisResult<number>> {
		try {
			const deleted = await this.client.del(key);
			return { success: true, data: deleted };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async exists(key: string): Promise<RedisResult<boolean>> {
		try {
			const exists = await this.client.exists(key);
			return { success: true, data: exists === 1 };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async keys(pattern: string): Promise<string[]> {
		try {
			return await this.client.keys(pattern);
		} catch (error) {
			console.error("[Redis] Keys error:", (error as Error).message);
			return [];
		}
	}

	async acquireLock(
		lockKey: string,
		ttlSeconds: number = 10,
	): Promise<RedisResult<boolean>> {
		try {
			const result = await this.client.set(
				lockKey,
				"1",
				"EX",
				ttlSeconds,
				"NX",
			);
			return { success: true, data: result === "OK" };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async releaseLock(lockKey: string): Promise<RedisResult<number>> {
		return this.remove(lockKey);
	}

	async waitForLock(
		lockKey: string,
		timeoutMs: number = 5000,
		pollIntervalMs: number = 50,
	): Promise<RedisResult<boolean>> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeoutMs) {
			const existsResult = await this.exists(lockKey);
			if (!existsResult.success) {
				return { success: false, error: existsResult.error };
			}
			if (!existsResult.data) {
				return { success: true, data: true };
			}
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}
		return { success: true, data: false };
	}

	async getOrWait<T>(
		key: string,
		timeoutMs: number = 5000,
		pollIntervalMs: number = 50,
	): Promise<RedisResult<T | null>> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeoutMs) {
			const readResult = await this.read<T>(key);
			if (!readResult.success) {
				return { success: false, error: readResult.error };
			}
			if (readResult.data !== null) {
				return { success: true, data: readResult.data };
			}
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}
		return { success: true, data: null };
	}
}
