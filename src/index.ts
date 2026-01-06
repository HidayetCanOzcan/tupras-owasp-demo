import { Elysia } from "elysia";
import { PostgreSQLManager, RedisManager } from "./Managers";
import { CREATE_AUTH_USER, CREATE_PASSWORD_RESET_TOKENS } from "./constants";

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
	.listen(3000);
