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
