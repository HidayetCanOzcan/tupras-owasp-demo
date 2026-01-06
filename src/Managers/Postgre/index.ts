import { Pool, type QueryResultRow } from "pg";

type PgResult<T = QueryResultRow> =
	| { success: true; data: T }
	| { success: false; error: string };

export type PgManagerConfig = {
	database: string;
	user: string;
	password: string;
	host: string;
	port: number;
	connectionTimeoutMillis?: number;
};

const assertPgConfig = (config?: Partial<PgManagerConfig>) => {
	if (!config) {
		throw new Error("PostgreSQL config must be provided.");
	}

	const required: Array<keyof PgManagerConfig> = [
		"database",
		"user",
		"password",
		"host",
		"port",
	];

	const missing = required.filter((key) => config[key] === undefined);

	if (missing.length > 0) {
		throw new Error(
			`PostgreSQL config missing required fields: ${missing.join(", ")}`,
		);
	}
};

export class PostgreSQLManager {
	private static instances = new Map<string, PostgreSQLManager>();
	private pool: Pool;

	constructor(config?: PgManagerConfig) {
		if (!config && !PostgreSQLManager.instances.size) {
			throw new Error(
				"PostgreSQL config must be provided for first initialization.",
			);
		} else if (!config) {
			// Use the first instance's config if available
			const firstInstance = Array.from(PostgreSQLManager.instances.values())[0];
			this.pool = firstInstance.pool;
			return;
		}

		assertPgConfig(config);

		const key = JSON.stringify({
			host: config.host,
			port: config.port,
			database: config.database,
			user: config.user,
		});

		const existing = PostgreSQLManager.instances.get(key);

		if (existing) {
			this.pool = existing.pool;
			return;
		}

		this.pool = new Pool({
			host: config.host,
			port: config.port,
			database: config.database,
			user: config.user,
			password: config.password,
			connectionTimeoutMillis: config.connectionTimeoutMillis,
		});

		PostgreSQLManager.instances.set(key, this);
	}

	async execute<T extends QueryResultRow = QueryResultRow>(
		sql: string,
		params: unknown[] = [],
	): Promise<PgResult<T[]>> {
		try {
			const result = await this.pool.query<T>(sql, params);
			return { success: true, data: result.rows };
		} catch (error) {
			console.error("PostgreSQL error:", error);
			return { success: false, error: (error as Error).message };
		}
	}

	async end(): Promise<void> {
		await this.pool.end();
	}
}
