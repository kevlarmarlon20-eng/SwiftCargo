-- init.sql: create packages table for SwiftCargo
CREATE TABLE IF NOT EXISTS packages (
  trackingnumber VARCHAR(32) PRIMARY KEY,
  sender JSONB,
  receiver JSONB,
  shipmentinfo JSONB,
  status TEXT,
  location TEXT,
  history JSONB
);
