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
import {
	deleteRefreshToken,
	deleteSession,
	generatePasswordHash,
	issueSession,
	readRefreshToken,
	readSession,
	signJWT,
	verifyJWT,
} from "./Service/AuthService";
import {
	findByUserId,
	findUserByEmail,
	sanitizeUser,
} from "./Service/UserService";
import type { DbUserRow, SanitizedUser } from "./Service/UserService/types";
import type { ApiResponse } from "./types";
import { validatePassword } from "./Service/AuthService/Password/Validate";

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
		jwt: {
			secret: "super-secret-key-change-in-production",
			accessTokenTtlSeconds: 15 * 60,
			algorithm: "HS256" as const,
		},
		cookie_names: {
			accessToken: "access_token",
			refreshToken: "refresh_token",
			session: "session_id",
		},
		cookie_settings: {
			httpOnly: true,
			secure: true,
			sameSite: "strict" as const,
			path: "/",
		},
		environment: "development",
		email_regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		min_password_length: 12,
		// password_reset_expiry_minutes: 15,
		auth_bypass_routes: ["/v1/fixed/login", "/v1/fixed/register"],
		rate_limit: {
			window_seconds: 60,
			max_requests: 100,
			auth_max_requests: 5,
			auth_routes: [
				"/v1/fixed/login",
				"/v1/fixed/register",
				"/v1/fixed/change-password",
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

		const cookies = (request.headers.get("cookie")?.split(";") || []).reduce<
			Record<string, string>
		>((acc, cookie) => {
			const [key, value] = cookie.trim().split("=");
			if (key && value) {
				acc[key] = value;
			}
			return acc;
		}, {});

		let accessToken = cookies[store.cookie_names.accessToken];
		const refreshToken = cookies[store.cookie_names.refreshToken];

		if (!accessToken && !refreshToken) {
			const bearer = request.headers.get("authorization")?.split(" ")[1];
			if (bearer) {
				accessToken = bearer;
			}
		}

		const session_id = cookies[store.cookie_names.session];

		if (store.auth_bypass_routes.includes(pathname)) {
			return;
		}

		if (!session_id) {
			set.status = 401;
			return {
				error: "Unauthorized",
				success: false,
				code: 401,
			};
		}

		const sessionData = await readSession({ sessionId: session_id });

		if (!sessionData) {
			set.status = 401;
			return {
				error: "Unauthorized",
				success: false,
				code: 401,
			};
		}

		const jwtResult = accessToken
			? verifyJWT(accessToken, store.jwt.secret)
			: null;

		const accessTokenValid = jwtResult?.valid === true;

		const refreshTokenData = await readRefreshToken({
			token: refreshToken || ",",
			jwtSecret: store.jwt.secret,
		});

		const refreshTokenValid =
			refreshTokenData?.success && refreshTokenData.record;

		if (!accessTokenValid && refreshTokenValid) {
			const newAccessToken = signJWT(
				{
					subject: sessionData.userId,
					expiresInSeconds: store.jwt.accessTokenTtlSeconds,
					issuer: "auth",
					audience: "api",
					sessionId: session_id,
					customClaims: {
						refreshTokenId: refreshTokenData.record?.token,
					},
				},
				store.jwt.secret,
			);

			accessToken = newAccessToken;

			const cookieValue = `${store.cookie_names.accessToken}=${accessToken}; Path=/; HttpOnly; SameSite=Lax`;

			set.headers["Set-Cookie"] = cookieValue;
		}

		const _user_id_ =
			accessTokenValid && jwtResult.valid
				? jwtResult.payload.sub
				: sessionData.userId;

		request.headers.set("x-access-token", accessToken);
		request.headers.set("x-refresh-token", refreshToken || "");
		request.headers.set("x-session-id", session_id);
		request.headers.set("x-user-id", _user_id_ || "");

		if (!accessTokenValid || !refreshTokenValid) {
			set.status = 401;
			return {
				error: "Unauthorized",
				success: false,
				code: 401,
			};
		}

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
			.get("/me", async ({ request, set }) => {
				const userId = request.headers.get("x-user-id");
				if (!userId) {
					set.status = 500;
					return {
						success: false,
						error: "Internal server error",
						code: 500,
						message: "Internal server error",
					};
				}

				const pg = new PostgreSQLManager();
				const userResult = await findByUserId(userId, pg);

				if (!userResult.success || !userResult.data) {
					set.status = 404;
					return {
						success: false,
						error: "User not found",
						code: 404,
						message: "User not found",
					};
				}

				set.status = 200;

				return {
					success: true,
					code: 200,
					data: sanitizeUser(userResult.data),
				};
			})
			.get("/admin/audit-logs", async ({ request, set }) => {
				const userId = request.headers.get("x-user-id");
				if (!userId) {
					set.status = 500;
					return {
						success: false,
						error: "Internal server error",
						code: 500,
						message: "Internal server error",
					};
				}

				const pg = new PostgreSQLManager();
				const userResult = await findByUserId(userId, pg);
				if (!userResult.success || !userResult.data) {
					set.status = 401;
					return {
						success: false,
						error: "Unauthorized",
						code: 401,
						message: "Unauthorized",
					};
				}

				if (userResult.data.role !== "admin") {
					set.status = 403;
					return {
						success: false,
						error: "Forbidden",
						code: 403,
						message: "Forbidden",
					};
				}

				const redis = new RedisManager();
				const keys = await redis.keys("aduidt:*");

				type AuditLog = {
					id: string;
					user_id: string;
					action: string;
					ip_address: string;
					user_agent: string;
					created_at: string;
					timestamp: number;
				};

				const logs: AuditLog[] = [];

				for (const key of keys.slice(0, 100)) {
					const result = await redis.read<AuditLog>(key);
					if (result.success && result.data) {
						logs.push(result.data);
					}
				}

				logs.sort((a, b) => {
					return (
						new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
					);
				});

				set.status = 200;
				return {
					success: true,
					code: 200,
					data: logs,
				};
			})
			.get("/users/search", async ({ query, set }) => {
				const { search } = query;
				if (!search || search.length < 2) {
					set.status = 400;
					return {
						success: false,
						error: "Invalid search query",
						code: 400,
						message: "Invalid search query",
					};
				}
				const pg = new PostgreSQLManager();
				const result = await pg.execute(
					"SELECT id, email, full_name, role FROM auth_users WHERE email ILIKE $1 OR full_name ILIKE $1",
					[`%${search}%`],
				);
				if (!result.success) {
					set.status = 500;
					return {
						success: false,
						error: "Internal server error",
						code: 500,
						message: "Internal server error",
					};
				}
				set.status = 200;
				return {
					success: true,
					code: 200,
					data: result.data,
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

					const tokens = await issueSession({
						userId: userId,
						jwtSecret: store.jwt.secret,
					});

					if (!tokens.success) {
						set.status = 500;
						return {
							error: "Token generation failed",
							code: 500,
							success: false,
							message: "Token generation failed",
						};
					}

					set.status = 201;

					set.cookie = {
						[store.cookie_names.accessToken]: {
							value: tokens.data.accessToken,
							...store.cookie_settings,
						},
						[store.cookie_names.refreshToken]: {
							value: tokens.data.refreshToken,
							...store.cookie_settings,
						},
						[store.cookie_names.session]: {
							value: tokens.data.sessionId,
							...store.cookie_settings,
						},
					};

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
			)
			.post(
				"/login",
				async ({ body, set, store }) => {
					const { email, password } = body;

					if (!email || !password) {
						set.status = 400;
						return {
							error: "Bad request",
							code: 400,
							success: false,
							message: "Email and password are required",
						};
					}

					const pg = new PostgreSQLManager();
					const userResult = await findUserByEmail(email, pg);

					if (!userResult.success) {
						set.status = 500;
						return {
							error: "Db error",
							code: 500,
							success: false,
							message: "Database error",
						};
					}

					if (!userResult.data) {
						set.status = 401;
						return {
							error: "Unauthorized",
							code: 401,
							success: false,
							message: "Invalid credentials",
						};
					}

					const passwordValid = validatePassword({
						password,
						hash: userResult.data.password_hash,
					});

					if (!passwordValid) {
						set.status = 401;
						return {
							error: "Unauthorized",
							code: 401,
							success: false,
							message: "Invalid credentials",
						};
					}

					const tokens = await issueSession({
						userId: userResult.data.id,
						jwtSecret: store.jwt.secret,
					});

					if (!tokens.success) {
						set.status = 500;
						return {
							error: "Token error",
							code: 500,
							success: false,
							message: "Token error",
						};
					}

					set.cookie = {
						[store.cookie_names.accessToken]: {
							value: tokens.data.accessToken,
							...store.cookie_settings,
						},
						[store.cookie_names.refreshToken]: {
							value: tokens.data.refreshToken,
							...store.cookie_settings,
						},
						[store.cookie_names.session]: {
							value: tokens.data.sessionId,
							...store.cookie_settings,
						},
					};

					return {
						data: sanitizeUser(userResult.data),
						success: true,
						code: 200,
						message: "User logged in successfully",
					};
				},
				{
					body: t.Object({
						email: t.String(),
						password: t.String(),
					}),
				},
			)
			.post(
				"/logout",
				async ({ request, set }) => {
					const refreshToken = request.headers.get("x-refresh-token");
					const sessionId = request.headers.get("x-session-id");

					if (!refreshToken || !sessionId) {
						set.status = 400;
						return {
							error: "Bad request",
							code: 400,
							success: false,
							message: "Missing refresh token or session id",
						};
					}

					await deleteRefreshToken({ token: refreshToken });
					await deleteSession({ sessionId });

					return {
						success: true,
						code: 200,
						message: "User logged out successfully",
					};
				},
				{
					body: t.Undefined(),
				},
			)
			.get(
				"/fetch-url",
				async ({ query, set }) => {
					const { url } = query;

					if (!url) {
						set.status = 400;
						return { error: "URL required", success: false, code: 400 };
					}

					const allowedDomains = [
						"api.github.com",
						"jsonplaceholder.typicode.com",
						"httpbin.org",
					];

					let parsedUrl: URL;
					try {
						parsedUrl = new URL(url);
					} catch {
						set.status = 400;
						return { error: "Invalid URL format", success: false, code: 400 };
					}

					if (parsedUrl.protocol !== "https:") {
						set.status = 400;
						return {
							error: "Only HTTPS URLs allowed",
							success: false,
							code: 400,
						};
					}

					if (!allowedDomains.includes(parsedUrl.hostname)) {
						set.status = 400;
						return {
							error: "Domain not in allowlist",
							success: false,
							code: 400,
						};
					}

					const privateIpPatterns = [
						/^localhost$/i,
						/^127\./,
						/^10\./,
						/^172\.(1[6-9]|2[0-9]|3[0-1])\./,
						/^192\.168\./,
						/^0\./,
						/^169\.254\./,
						/^::1$/,
						/^fc00:/i,
						/^fe80:/i,
					];

					if (privateIpPatterns.some((p) => p.test(parsedUrl.hostname))) {
						set.status = 400;
						return {
							error: "Private/internal addresses not allowed",
							success: false,
							code: 400,
						};
					}

					try {
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), 5000);

						const response = await fetch(url, {
							signal: controller.signal,
							redirect: "error",
						});

						clearTimeout(timeoutId);

						const contentType = response.headers.get("content-type") || "";
						let data: string | object;

						if (contentType.includes("application/json")) {
							data = await response.json();
						} else {
							const text = await response.text();
							data = text.slice(0, 10000);
						}

						return {
							success: true,
							data,
							status: response.status,
							code: 200,
						};
					} catch (_error) {
						set.status = 500;
						return {
							success: false,
							error: "Failed to fetch URL",
							code: 500,
						};
					}
				},
				{
					query: t.Object({
						url: t.String(),
					}),
				},
			),
	)
	.group("/v1/vulnarable", (app) =>
		app
			.get("/health", () => {
				return {
					status: "ok",
				};
			})
			.get("/admin/audit-logs", async ({ request, set }) => {
				const userId = request.headers.get("x-user-id");
				if (!userId) {
					set.status = 500;
					return {
						success: false,
						error: "Internal server error",
						code: 500,
						message: "Internal server error",
					};
				}

				const pg = new PostgreSQLManager();
				const userResult = await findByUserId(userId, pg);
				if (!userResult.success || !userResult.data) {
					set.status = 401;
					return {
						success: false,
						error: "Unauthorized",
						code: 401,
						message: "Unauthorized",
					};
				}

				const redis = new RedisManager();
				const keys = await redis.keys("aduidt:*");

				type AuditLog = {
					id: string;
					user_id: string;
					action: string;
					ip_address: string;
					user_agent: string;
					created_at: string;
					timestamp: number;
				};

				const logs: AuditLog[] = [];

				for (const key of keys.slice(0, 100)) {
					const result = await redis.read<AuditLog>(key);
					if (result.success && result.data) {
						logs.push(result.data);
					}
				}

				logs.sort((a, b) => {
					return (
						new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
					);
				});

				set.status = 200;
				return {
					success: true,
					code: 200,
					data: logs,
				};
			})
			.get("/users/search", async ({ query, set }) => {
				const { search } = query;
				if (!search || search.length < 2) {
					set.status = 400;
					return {
						success: false,
						error: "Invalid search query",
						code: 400,
						message: "Invalid search query",
					};
				}
				const pg = new PostgreSQLManager();
				const result = await pg.execute(
					`SELECT id, email, full_name, role FROM auth_users WHERE email LIKE '%${search}%' OR full_name LIKE '%${search}%'`,
				);
				if (!result.success) {
					set.status = 500;
					return {
						success: false,
						error: "Internal server error",
						code: 500,
						message: "Internal server error",
					};
				}
				set.status = 200;
				return {
					success: true,
					code: 200,
					data: result.data,
				};
			})
			.get("/fetch-url", async ({ query, set }) => {
				const { url } = query;

				if (!url) {
					set.status = 400;
					return { error: "URL required", success: false, code: 400 };
				}

				try {
					const response = await fetch(url);
					const contentType = response.headers.get("content-type") || "";
					let data: string | object;

					if (contentType.includes("application/json")) {
						data = await response.json();
					} else {
						data = await response.text();
					}

					return {
						success: true,
						data,
						headers: Object.fromEntries(response.headers.entries()),
						status: response.status,
						code: 200,
					};
				} catch (error) {
					return {
						success: false,
						error: (error as Error).message,
						code: 500,
					};
				}
			})
			.post(
				"/auth/register",
				async ({ body, set, store }) => {
					const { email, password, fullName } = body;

					// VULNERABILITY 1: No email validation
					// Accepts any string as email

					// VULNERABILITY 2: No password policy
					// Accepts passwords like "123" or "a"
					if (!password) {
						set.status = 400;
						return {
							error: "Password required",
							success: false,
							code: 400,
						};
					}

					const pg = new PostgreSQLManager();

					// VULNERABILITY 3: User enumeration
					// Explicitly tells attacker if email exists
					const existing = await findUserByEmail(email, pg);
					if (!existing.success) {
						set.status = 500;
						// VULNERABILITY 4: Verbose error with internal details
						return {
							error: "Database connection failed",
							message: `PostgreSQL error: ${existing.error}`,
							debug: {
								host: process.env.PG_HOST,
								database: process.env.PG_DATABASE,
								timestamp: new Date().toISOString(),
							},
							success: false,
							code: 500,
						};
					}
					if (existing.data) {
						set.status = 409;
						// VULNERABILITY 3: Clear user enumeration
						return {
							error: "Email already registered",
							message: `The email ${email} is already in use since ${existing.data.created_at}`,
							success: false,
							code: 409,
						};
					}

					const userId = randomUUID();

					// VULNERABILITY 5: Weak password hashing (MD5)
					const crypto = await import("node:crypto");
					const weakHash = crypto
						.createHash("md5")
						.update(password)
						.digest("hex");

					// VULNERABILITY 6: SQL Injection in INSERT
					// String concatenation instead of parameterized query
					const insertQuery = `
						INSERT INTO auth_users (id, email, password_hash, full_name)
						VALUES ('${userId}', '${email}', '${weakHash}', '${fullName ?? ""}')
						RETURNING id, email, full_name, created_at, updated_at
					`;

					const insertResult = await pg.execute(insertQuery);

					if (!insertResult.success) {
						set.status = 500;
						// VULNERABILITY 4: Leaking SQL error details
						return {
							error: "Failed to create user",
							message: `SQL Error: ${insertResult.error}`,
							query: insertQuery, // VULNERABILITY 7: Exposing SQL query
							success: false,
							code: 500,
						};
					}

					const tokens = await issueSession({
						userId,
						jwtSecret: store.jwt.secret,
					});

					if (!tokens.success) {
						set.status = 500;
						return {
							error: "Failed to create session",
							success: false,
							code: 500,
						};
					}

					set.status = 201;

					set.cookie = {
						[store.cookie_names.accessToken]: {
							value: tokens.data.accessToken,
							...store.cookie_settings,
						},
						[store.cookie_names.refreshToken]: {
							value: tokens.data.refreshToken,
							...store.cookie_settings,
						},
						[store.cookie_names.session]: {
							value: tokens.data.sessionId,
							...store.cookie_settings,
						},
					};

					return {
						data: sanitizeUser(insertResult.data[0] as DbUserRow),
						// VULNERABILITY 8: Exposing sensitive info in response
						debug: {
							passwordHash: weakHash,
							hashAlgorithm: "MD5",
							jwtSecret: `${store.jwt.secret.substring(0, 10)}...`,
						},
						success: true,
						code: 201,
					};
				},
				{
					body: t.Object({
						email: t.String(),
						password: t.String(),
						fullName: t.Optional(t.String()),
					}),
				},
			),
	)
	.listen(3000);
