import { randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
import {
	CREATE_AUTH_USER,
	CREATE_DEMO_PG_TEST_TABLE,
	CREATE_PASSWORD_RESET_TOKENS,
	DELETE_DEMO_PG_TEST_TABLE,
	INSERT_DEMO_PG_TEST_TABLE,
	INSERT_USER,
	SELECT_DEMO_PG_TEST_TABLE,
	UPDATE_DEMO_PG_TEST_TABLE,
} from "./constants";
import { PostgreSQLManager, RedisManager } from "./Managers";
import { generatePasswordHash } from "./Service/AuthService";
import { findUserByEmail, sanitizeUser } from "./Service/UserService";
import type { DbUserRow, SanitizedUser } from "./Service/UserService/types";
import type { ApiResponse } from "./types";

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
		email_regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		min_password_length: 12,
		// password_reset_expiry_minutes: 15,
		auth_bypass_routes: ["/v1/fixed/auth/login", "/v1/fixed/auth/register"],
		rate_limit: {
			window_seconds: 60,
			max_requests: 100,
			auth_max_requests: 5,
			auth_routes: [
				"/v1/fixed/auth/login",
				"/v1/fixed/auth/register",
				"/v1/fixed/auth/change-password",
			],
		},
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
	.onRequest(async ({ request, store, set }) => {
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

		//#region Audit Log
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
		//#endregion

		//#region Rate Limit
		if (store.auth_bypass_routes.includes(pathname)) {
			return;
		}
		const isAuthRoute = store.rate_limit.auth_routes.some((route) =>
			pathname.includes(route),
		);
		const rateLimitKey = isAuthRoute
			? `rateLimit:auth:${clientIp}`
			: `rateLimit:global:${clientIp}`;
		const maxRequests = isAuthRoute
			? store.rate_limit.auth_max_requests
			: store.rate_limit.max_requests;

		const currentCount = await redis.read<number>(rateLimitKey);
		const count =
			currentCount.success && currentCount.data ? currentCount.data : 0;

		if (count >= maxRequests) {
			set.status = 429;
			set.headers["Retry-After"] = String(store.rate_limit.window_seconds);
			return {
				error: "Rate limit exceeded",
				retryAfter: store.rate_limit.window_seconds,
				success: false,
				code: 429,
			};
		}

		if (count === 0) {
			await redis.create(rateLimitKey, 1, store.rate_limit.window_seconds);
		} else {
			await redis.update(rateLimitKey, count + 1);
		}
		set.headers["X-RateLimit-Limit"] = String(maxRequests);
		set.headers["X-RateLimit-Remaining"] = String(
			Math.max(0, maxRequests - count - 1),
		);
		//#endregion
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
	.group("/v1/fixed", (app) =>
		app
			.get("/health", () => {
				return {
					status: "ok",
				};
			})
			.post(
				"/register",
				async ({ body, set, store }): Promise<ApiResponse<SanitizedUser>> => {
					const { email, password, fullName } = body;

					if (!email || !store.email_regex.test(email)) {
						set.status = 400;
						return {
							success: false,
							error: "Invalid email",
							code: 400,
							message: "Invalid email",
						};
					}

					if (!password || password.length < store.min_password_length) {
						set.status = 400;
						return {
							success: false,
							error: "Invalid password",
							code: 400,
							message: "Invalid password",
						};
					}

					const pg = new PostgreSQLManager();

					const existing = await findUserByEmail(email, pg);

					if (!existing.success) {
						set.status = 500;
						return {
							error: "DB error",
							code: 500,
							success: false,
							message: "Error while checking user",
						};
					}

					if (existing.data) {
						set.status = 409;
						return {
							error: "Email already exists",
							code: 409,
							success: false,
							message: "Email already exists",
						};
					}

					const userId = randomUUID();

					const { hash } = generatePasswordHash({ password });

					const insertResult = await pg.execute(INSERT_USER, [
						userId,
						email.toLowerCase().trim(),
						hash,
						fullName ?? null,
					]);

					if (!insertResult.success) {
						set.status = 500;
						return {
							error: "DB error",
							code: 500,
							success: false,
							message: "Error while creating user",
						};
					}

					return {
						data: sanitizeUser(insertResult.data[0] as DbUserRow),
						success: true,
						code: 201,
						message: "User created successfully",
					};
				},
				{
					body: t.Object({
						email: t.String(),
						password: t.String(),
						fullName: t.String(),
					}),
				},
			),
	)
	.group("/v1/vulnarable", (app) =>
		app.get("/health", () => {
			return {
				status: "ok",
			};
		}),
	)
	.listen(3000);
