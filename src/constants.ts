export const CREATE_AUTH_USER = `
		CREATE TABLE IF NOT EXISTS auth_users (
			id UUID PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			full_name TEXT,
			role TEXT DEFAULT 'user' NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)
	`;
export const CREATE_PASSWORD_RESET_TOKENS = `
		CREATE TABLE IF NOT EXISTS auth_password_resets (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
			token TEXT UNIQUE NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			used_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)
	`;

export const CREATE_DEMO_PG_TEST_TABLE = `
			CREATE TABLE IF NOT EXISTS demo_pg_test (
				id SERIAL PRIMARY KEY,
				value TEXT NOT NULL
			)
		`;

export const INSERT_DEMO_PG_TEST_TABLE = `INSERT INTO demo_pg_test (value) VALUES ($1) RETURNING id, value`;
export const SELECT_DEMO_PG_TEST_TABLE = `SELECT id, value FROM demo_pg_test WHERE id = $1`;
export const UPDATE_DEMO_PG_TEST_TABLE = `UPDATE demo_pg_test SET value = $1 WHERE id = $2 RETURNING id, value`;
export const DELETE_DEMO_PG_TEST_TABLE = `DELETE FROM demo_pg_test WHERE id = $1`;
