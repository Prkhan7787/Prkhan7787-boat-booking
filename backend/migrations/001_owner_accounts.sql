-- Additive, repeatable migration. Existing users and boats are preserved.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','customer','boat_owner'));

ALTER TABLE boats ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS service_date DATE;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS boats_owner_idx ON boats(owner_id);
