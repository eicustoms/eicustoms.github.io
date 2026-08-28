const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * In production the `images/` directory is a Railway volume mounted over the
 * repo checkout, so anything committed to `images/` in git is invisible at
 * runtime. The committed, canonical copies therefore live in `seed-images/`
 * and are copied into the volume on boot.
 *
 * Two rules:
 *   1. Any seed file missing from the volume is copied in.
 *   2. Files listed in `image-migrations.json` are force-refreshed from the
 *      seed exactly once (each migration id is recorded in the volume), so a
 *      rename or replacement made in git also lands on an existing volume
 *      without clobbering admin uploads/optimizations on every deploy.
 */

const seedDir = path.join(__dirname, 'seed-images');
const MIGRATIONS_FILE = path.join(__dirname, 'image-migrations.json');
const APPLIED_FILE_NAME = '.applied-image-migrations.json';

const hashFile = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const readJson = (file, fallback) => {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Could not read ${file}:`, error.message);
    return fallback;
  }
};

const listSeedFiles = () => {
  if (!fs.existsSync(seedDir)) return [];
  return fs
    .readdirSync(seedDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
};

const copySeedFile = (filename, imagesDir) => {
  const source = path.join(seedDir, filename);
  const target = path.join(imagesDir, filename);
  fs.copyFileSync(source, target);
  return target;
};

/** Rule 1: copy in anything the volume is missing. */
const seedMissingImages = (imagesDir) => {
  const copied = [];

  for (const filename of listSeedFiles()) {
    if (fs.existsSync(path.join(imagesDir, filename))) continue;
    copySeedFile(filename, imagesDir);
    copied.push(filename);
  }

  if (copied.length) {
    console.log(`✓ Seeded ${copied.length} image(s) into the volume: ${copied.join(', ')}`);
  }

  return copied;
};

/** Rule 2: apply one-time forced refreshes declared in image-migrations.json. */
const applyImageMigrations = (imagesDir) => {
  const migrations = readJson(MIGRATIONS_FILE, []);
  if (!Array.isArray(migrations) || migrations.length === 0) return [];

  const appliedFile = path.join(imagesDir, APPLIED_FILE_NAME);
  const applied = new Set(readJson(appliedFile, []));
  const justApplied = [];

  for (const migration of migrations) {
    if (!migration || !migration.id || applied.has(migration.id)) continue;

    const files = Array.isArray(migration.replaceFromSeed) ? migration.replaceFromSeed : [];
    for (const filename of files) {
      const source = path.join(seedDir, filename);
      if (!fs.existsSync(source)) {
        console.error(`Image migration ${migration.id}: seed-images/${filename} is missing, skipping`);
        continue;
      }

      const target = path.join(imagesDir, filename);
      if (fs.existsSync(target) && hashFile(target) === hashFile(source)) continue;

      copySeedFile(filename, imagesDir);
      console.log(`✓ Image migration ${migration.id}: refreshed ${filename} from seed`);
    }

    for (const filename of migration.delete || []) {
      const target = path.join(imagesDir, path.basename(filename));
      if (!fs.existsSync(target)) continue;
      fs.unlinkSync(target);
      console.log(`✓ Image migration ${migration.id}: removed stale ${filename}`);
    }

    applied.add(migration.id);
    justApplied.push(migration.id);
  }

  if (justApplied.length) {
    fs.writeFileSync(appliedFile, JSON.stringify([...applied], null, 2));
  }

  return justApplied;
};

const syncImages = (imagesDir) => {
  try {
    applyImageMigrations(imagesDir);
    seedMissingImages(imagesDir);
  } catch (error) {
    // Never let image seeding stop the server from booting.
    console.error('Image seeding failed:', error);
  }
};

module.exports = { syncImages, seedMissingImages, applyImageMigrations, seedDir };
