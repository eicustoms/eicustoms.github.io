const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

let pool = null;

// Initialize the pool reference (will be set from server.js)
const setPool = (pgPool) => {
  pool = pgPool;
};

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const imagesDir = path.join(dataDir, 'images');
const backupDir = path.join(imagesDir, 'backups');

const galleryImagesToProcess = [
  'image1.jpeg',
  'image2.jpeg',
  'image4.jpeg',
  'image5.jpeg',
  'image6.jpeg',
  'image7.jpeg',
  'image8.jpeg',
  'image9.jpeg',
  'image10.jpeg',
  'image11.jpeg',
  'image12.jpeg',
  'image13.jpeg',
  'image14.jpeg',
  'image15.jpeg',
  'image16.jpeg',
  'image18.jpeg'
];

function ensureDataDirectories() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

function sanitizeFilename(filename) {
  return path.basename(filename);
}

function isValidImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png'].includes(ext);
}

async function backupFileIfNeeded(filename) {
  const safeName = sanitizeFilename(filename);
  const inputPath = path.join(imagesDir, safeName);
  const backupPath = path.join(backupDir, `${safeName}.orig`);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${safeName}`);
  }
  if (!fs.existsSync(backupPath)) {
    ensureBackupDir();
    fs.copyFileSync(inputPath, backupPath);
  }
}

async function optimizeSingleImage(filename, quality = 80) {
  const safeName = sanitizeFilename(filename);
  if (!isValidImageFile(safeName)) {
    throw new Error('Invalid image type');
  }

  const inputPath = path.join(imagesDir, safeName);
  const tmpPath = `${inputPath}.tmp`;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Image not found: ${safeName}`);
  }

  await backupFileIfNeeded(safeName);

  const extension = path.extname(safeName).toLowerCase();
  const transformer = sharp(inputPath).resize(1200, 900, {
    fit: 'inside',
    withoutEnlargement: true
  });

  if (extension === '.png') {
    transformer.png({ compressionLevel: 9, palette: true });
  } else {
    transformer.jpeg({ quality, progressive: true });
  }

  await transformer.toFile(tmpPath);
  fs.renameSync(tmpPath, inputPath);
}

async function deoptimizeSingleImage(filename) {
  const safeName = sanitizeFilename(filename);
  const backupPath = path.join(backupDir, `${safeName}.orig`);
  const inputPath = path.join(imagesDir, safeName);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`No backup available for ${safeName}`);
  }

  fs.copyFileSync(backupPath, inputPath);
}

async function getOptimizeCandidates() {
  if (!pool) {
    return [];
  }
  const result = await pool.query(
    'SELECT id, filename, description, quality, active, created_at, updated_at FROM image_optimizer_config ORDER BY id ASC'
  );
  return result.rows;
}

async function addOptimizeImage(filename, description = '', active = true, quality = 80) {
  const safeName = sanitizeFilename(filename);
  if (!isValidImageFile(safeName)) {
    throw new Error('Invalid image type. Only JPG and PNG are allowed.');
  }

  if (!pool) {
    throw new Error('Database not available');
  }

  const qualityVal = Math.min(95, Math.max(60, parseInt(quality, 10) || 80));

  const result = await pool.query(
    `INSERT INTO image_optimizer_config (filename, description, quality, active, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (filename) DO UPDATE
       SET description = EXCLUDED.description,
           quality     = EXCLUDED.quality,
           active      = EXCLUDED.active,
           updated_at  = NOW()
     RETURNING *`,
    [safeName, description || '', qualityVal, active]
  );

  return result.rows[0];
}

async function updateOptimizeImage(filename, updates) {
  const safeName = sanitizeFilename(filename);

  if (!pool) {
    throw new Error('Database not available');
  }

  const setClauses = ['updated_at = NOW()'];
  const values = [];
  let idx = 1;

  if (typeof updates.active === 'boolean') {
    setClauses.push(`active = $${idx++}`);
    values.push(updates.active);
  }
  if (typeof updates.description === 'string') {
    setClauses.push(`description = $${idx++}`);
    values.push(updates.description);
  }
  if (updates.quality !== undefined) {
    const qualityVal = Math.min(95, Math.max(60, parseInt(updates.quality, 10) || 80));
    setClauses.push(`quality = $${idx++}`);
    values.push(qualityVal);
  }

  values.push(safeName);

  const result = await pool.query(
    `UPDATE image_optimizer_config SET ${setClauses.join(', ')} WHERE filename = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Image not found in optimizer config');
  }

  return result.rows[0];
}

async function optimizeActiveImages() {
  if (!pool) {
    throw new Error('Database not available');
  }

  const result = await pool.query(
    'SELECT filename, quality FROM image_optimizer_config WHERE active = TRUE'
  );

  for (const image of result.rows) {
    try {
      await optimizeSingleImage(image.filename, image.quality || 80);
      console.log(`Optimized ${image.filename} (quality=${image.quality || 80})`);
    } catch (error) {
      console.error(`Failed to optimize ${image.filename}:`, error.message);
    }
  }
}

async function optimizeGalleryImages() {
  ensureDataDirectories();

  const galleryMetadata = [];

  for (const imageFile of galleryImagesToProcess) {
    const inputPath = path.join(imagesDir, imageFile);
    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${imageFile} - file not found`);
      continue;
    }

    try {
      await optimizeSingleImage(imageFile, 80);
      const stats = fs.statSync(inputPath);
      galleryMetadata.push({
        filename: imageFile,
        uploadedAt: stats.mtime.toISOString(),
        display_name: imageFile.replace(/\.(jpeg|jpg)$/i, '').replace(/image/, 'Watch ')
      });
      console.log(`✓ Optimized ${imageFile}`);
    } catch (error) {
      console.error(`✗ Error optimizing ${imageFile}:`, error.message);
    }
  }

  galleryMetadata.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  if (pool) {
    // Persist gallery metadata to database
    for (const item of galleryMetadata) {
      try {
        await pool.query(
          `INSERT INTO gallery_metadata (filename, display_name, uploaded_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (filename) DO UPDATE
             SET display_name = EXCLUDED.display_name,
                 uploaded_at  = EXCLUDED.uploaded_at`,
          [item.filename, item.display_name, item.uploadedAt]
        );
      } catch (err) {
        console.error(`Failed to save gallery metadata for ${item.filename}:`, err.message);
      }
    }
    console.log(`\n✓ Gallery metadata saved to database (${galleryMetadata.length} images)`);
  } else {
    console.log('\n⚠️  No database available — gallery metadata not persisted');
  }
}

module.exports = {
  setPool,
  getOptimizeCandidates,
  optimizeSingleImage,
  deoptimizeSingleImage,
  optimizeActiveImages,
  addOptimizeImage,
  updateOptimizeImage,
  optimizeGalleryImages
};

if (require.main === module) {
  optimizeGalleryImages().catch(error => {
    console.error('Optimization failed:', error);
    process.exit(1);
  });
}
