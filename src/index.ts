import { Elysia } from "elysia";
import { PostgreSQLManager, RedisManager } from "./Managers";
import {
	CREATE_AUTH_USER,
	CREATE_DEMO_PG_TEST_TABLE,
	CREATE_PASSWORD_RESET_TOKENS,
	DELETE_DEMO_PG_TEST_TABLE,
	INSERT_DEMO_PG_TEST_TABLE,
	SELECT_DEMO_PG_TEST_TABLE,
	UPDATE_DEMO_PG_TEST_TABLE,
} from "./constants";
import { randomUUID } from "node:crypto";

new Elysia()
	.state({
		redisConfig: {
			host: "127.0.0.1",
			port: 6379,
		},
		redisKeys: {
			test: "demo:redis:test",
		},
		postgres: {
			database: "tupras_owasp",
			user: "postgres",
			password: "postgres",
			host: "127.0.0.1",
			port: 5432,
			connectionTimeoutMillis: 3_000,
		},
		// jwt: {
		// 	secret: "super-secret-key-change-in-production",
		// 	accessTokenTtlSeconds: 15 * 60,
		// 	algorithm: "HS256" as const,
		// },
		// cookie_names: {
		// 	accessToken: "access_token",
		// 	refreshToken: "refresh_token",
		// 	session: "session_id",
		// },
		// cookie_settings: {
		// 	httpOnly: true,
		// 	secure: true,
		// 	sameSite: "strict" as const,
		// 	path: "/",
		// },
		environment: "development",
		// email_regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		// min_password_length: 12,
		// password_reset_expiry_minutes: 15,
		// auth_bypass_routes: ["/v1/fixed/auth/login", "/v1/fixed/auth/register"],
		// rate_limit: {
		// 	window_seconds: 60,
		// 	max_requests: 100,
		// 	auth_max_requests: 5,
		// 	auth_routes: [
		// 		"/v1/fixed/auth/login",
		// 		"/v1/fixed/auth/register",
		// 		"/v1/fixed/auth/change-password",
		// 	],
		// },
	})
	.onStart(async ({ store }) => {
		const config = store.postgres;

		const pgManager = new PostgreSQLManager({ ...config });
		const result = await pgManager.execute("SELECT current_database() as db");
		if (result.success) {
			const create_user_table = await pgManager.execute(CREATE_AUTH_USER);
			const create_password_reset_table = await pgManager.execute(
				CREATE_PASSWORD_RESET_TOKENS,
			);
			if (!create_user_table.success || !create_password_reset_table.success) {
				console.error("Failed to create tables");
			}
		}
		const redisManager = new RedisManager({ ...store.redisConfig });
		const redisResult = await redisManager.exists("healthcheck");
		console.log("Redis connection test:", redisResult);
	})
	.onRequest(async ({ request, store }) => {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method;
		const query = url.search;
		const userId = request.headers.get("x-user-id") || "anonymous";
		const sessionId = request.headers.get("x-session-id") || "none";
		const clientIp =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip")?.trim() ||
			"unknown";
		const userAgent = request.headers.get("user-agent") || "unknown";

		const auditLog = {
			timestamp: new Date().toISOString(),
			pathname,
			method,
			query,
			userId,
			sessionId,
			clientIp,
			userAgent,
		};

		const redis = new RedisManager();
		const auditKey = `audit:${Date.now()}:${randomUUID}`;
		await redis.create(auditKey, auditLog);

		if (store.environment === "development") {
			console.log("Audit log:", auditLog);
		}
	})
	.get("/redis/test", async ({ store }) => {
		const redisManager = new RedisManager();
		const key = store.redisKeys.test;

		const createResult = await redisManager.create(key, {
			value: "lorem ipsum",
		});
		const readResult = await redisManager.read<{ value: string }>(key);
		const updateResult = await redisManager.update(key, { value: "dolor sit" });
		const updatedResult = await redisManager.read<{ value: string }>(key);
		const deleteResult = await redisManager.remove(key);
		const existResult = await redisManager.exists(key);

		return {
			create: createResult,
			read: readResult,
			update: updateResult,
			updated: updatedResult,
			delete: deleteResult,
			exist: existResult,
		};
	})
	.get("/postgre/test", async () => {
		const pgManager = new PostgreSQLManager();
		const ensureTable = await pgManager.execute(CREATE_DEMO_PG_TEST_TABLE);

		if (!ensureTable.success) {
			return {
				success: false,
				error: "Failed to create table",
			};
		}

		const insertResult = await pgManager.execute(INSERT_DEMO_PG_TEST_TABLE, [
			"test",
		]);
		const insertedId = insertResult.success ? insertResult.data[0].id : null;

		const readResult = await pgManager.execute(SELECT_DEMO_PG_TEST_TABLE, [
			insertedId,
		]);

		const updateResult = await pgManager.execute(UPDATE_DEMO_PG_TEST_TABLE, [
			"updated",
			insertedId,
		]);
		const updatedResult = await pgManager.execute(SELECT_DEMO_PG_TEST_TABLE, [
			insertedId,
		]);
		const deleteResult = await pgManager.execute(DELETE_DEMO_PG_TEST_TABLE, [
			insertedId,
		]);

		return {
			insert: insertResult,
			read: readResult,
			update: updateResult,
			updated: updatedResult,
			delete: deleteResult,
		};
	})
	.listen(3000);
