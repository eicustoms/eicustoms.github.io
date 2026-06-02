CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  custom_case TEXT,
  custom_bezel TEXT,
  custom_dial TEXT,
  custom_strap TEXT,
  custom_summary TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR PRIMARY KEY,
  author TEXT NOT NULL,
  service TEXT,
  image TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_metadata (
  filename TEXT PRIMARY KEY,
  display_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_optimizer_config (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  description TEXT,
  quality INT NOT NULL DEFAULT 80,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO image_optimizer_config (filename, description, quality, active)
SELECT 'eitan1.jpg', 'About page portrait', 85, true
WHERE NOT EXISTS (SELECT 1 FROM image_optimizer_config WHERE filename = 'eitan1.jpg');

INSERT INTO image_optimizer_config (filename, description, quality, active)
SELECT 'herowatch.jpg', 'Homepage hero background', 85, true
WHERE NOT EXISTS (SELECT 1 FROM image_optimizer_config WHERE filename = 'herowatch.jpg');
