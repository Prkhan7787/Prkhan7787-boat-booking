CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, phone VARCHAR(30), role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK(role IN ('admin','customer','boat_owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS boats (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(140) NOT NULL, type VARCHAR(50) NOT NULL, description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL CHECK(capacity > 0), speed VARCHAR(50) NOT NULL DEFAULT '',
  departure_port VARCHAR(120) NOT NULL, destination VARCHAR(120) NOT NULL, departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL, duration VARCHAR(50) NOT NULL, price NUMERIC(10,2) NOT NULL CHECK(price > 0),
  available_seats INTEGER NOT NULL CHECK(available_seats >= 0 AND available_seats <= capacity),
  amenities TEXT[] NOT NULL DEFAULT '{}', status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  featured BOOLEAN NOT NULL DEFAULT FALSE, owner_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  service_date DATE, contact_phone VARCHAR(30), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY, booking_code VARCHAR(40) UNIQUE NOT NULL, boat_id BIGINT NOT NULL REFERENCES boats(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  travel_date DATE NOT NULL, total_passengers INTEGER NOT NULL CHECK(total_passengers > 0),
  total_price NUMERIC(10,2) NOT NULL CHECK(total_price >= 0), status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS passengers (
  id BIGSERIAL PRIMARY KEY, booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL, nationality VARCHAR(80) NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings(travel_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS passengers_booking_idx ON passengers(booking_id);
