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

CREATE TABLE IF NOT EXISTS optimize_images (
  filename TEXT PRIMARY KEY,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO optimize_images (filename, description, active)
SELECT 'eitan1.jpg', 'About page portrait', true
WHERE NOT EXISTS (SELECT 1 FROM optimize_images WHERE filename = 'eitan1.jpg');

INSERT INTO optimize_images (filename, description, active)
SELECT 'herowatch.jpg', 'Homepage hero background', true
WHERE NOT EXISTS (SELECT 1 FROM optimize_images WHERE filename = 'herowatch.jpg');
