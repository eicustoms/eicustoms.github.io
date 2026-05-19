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
const configFile = path.join(dataDir, 'image-optimizer-config.json');
const backupDir = path.join(imagesDir, 'backups');
const galleryMetadataFile = path.join(dataDir, 'gallery-metadata.json');

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

const defaultOptimizeConfig = [
  { filename: 'eitan1.jpg', active: true, description: 'About page portrait' },
  { filename: 'herowatch.jpg', active: true, description: 'Homepage hero background' }
];

function ensureDataDirectories() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

function ensureConfigFile() {
  ensureDataDirectories();
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ images: defaultOptimizeConfig }, null, 2));
  }
}

function readOptimizeConfig() {
  ensureConfigFile();
  try {
    const raw = fs.readFileSync(configFile, 'utf8');
    const parsed = raw ? JSON.parse(raw) : { images: [] };
    return Array.isArray(parsed.images) ? parsed.images : [];
  } catch (error) {
    console.error('Failed to read image optimizer config:', error);
    return [];
  }
}

function writeOptimizeConfig(images) {
  ensureConfigFile();
  fs.writeFileSync(configFile, JSON.stringify({ images }, null, 2));
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

async function optimizeSingleImage(filename) {
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
    transformer.jpeg({ quality: 80, progressive: true });
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

async function optimizeActiveImages() {
  const images = readOptimizeConfig().filter(item => item.active);
  for (const image of images) {
    try {
      await optimizeSingleImage(image.filename);
      console.log(`Optimized ${image.filename}`);
    } catch (error) {
      console.error(`Failed to optimize ${image.filename}:`, error.message);
    }
  }
}

async function addOptimizeImage(filename, description = '', active = true) {
  const safeName = sanitizeFilename(filename);
  if (!isValidImageFile(safeName)) {
    throw new Error('Invalid image type. Only JPG and PNG are allowed.');
  }

  const images = readOptimizeConfig();
  const existing = images.find(item => item.filename === safeName);
  if (existing) {
    existing.description = description || existing.description;
    existing.active = active;
  } else {
    images.push({ filename: safeName, active, description });
  }

  writeOptimizeConfig(images);
  return images.find(item => item.filename === safeName);
}

function updateOptimizeImage(filename, updates) {
  const safeName = sanitizeFilename(filename);
  const images = readOptimizeConfig();
  const item = images.find(item => item.filename === safeName);
  if (!item) {
    throw new Error('Image not found in optimizer config');
  }

  if (typeof updates.active === 'boolean') {
    item.active = updates.active;
  }
  if (typeof updates.description === 'string') {
    item.description = updates.description;
  }

  writeOptimizeConfig(images);
  return item;
}

function getOptimizeCandidates() {
  if (pool) {
    // Synchronous read from database is not possible; this function is called synchronously
    // So we fall back to reading from file for now
    return readOptimizeConfig();
  }
  return readOptimizeConfig();
}

async function optimizeGalleryImages() {
  const galleryMetadata = [];

  for (const imageFile of galleryImagesToProcess) {
    const inputPath = path.join(imagesDir, imageFile);
    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${imageFile} - file not found`);
      continue;
    }

    try {
      await optimizeSingleImage(imageFile);
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
  fs.writeFileSync(galleryMetadataFile, JSON.stringify(galleryMetadata, null, 2));
  console.log(`\n✓ Gallery metadata saved to ${galleryMetadataFile}`);
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
