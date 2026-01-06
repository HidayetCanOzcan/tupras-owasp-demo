import { Elysia } from "elysia";
import { PostgreSQLManager, RedisManager } from "./Managers";

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
		try {
			const result = await pgManager.execute("SELECT current_database() as db");
			console.log("Database connection test:", result);
		} catch (error) {
			console.error("Database connection failed:", error);
		}

		const redisManager = new RedisManager({ ...store.redisConfig });
		try {
			const result = await redisManager.exists("healthcheck");
			console.log("Redis connection test:", result);
		} catch (error) {
			console.error("Redis connection failed:", error);
		}
	})
	.listen(3000);
