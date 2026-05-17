const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'images');
const galleryMetadata = [];

// Images to process (excluding image0.jpeg - diamond logo)
const imagesToProcess = [
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
  'image18.jpeg',
  'eitan1.jpg'
];

async function optimizeImages() {
  console.log('Starting image optimization...');

  for (const imageFile of imagesToProcess) {
    const inputPath = path.join(imagesDir, imageFile);
    const outputPath = path.join(imagesDir, imageFile);

    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${imageFile} - file not found`);
      continue;
    }

    try {
      // Get file stats for modification time
      const stats = fs.statSync(inputPath);
      const uploadedAt = stats.mtime.toISOString();

      // Optimize the image: resize to max 1200px width, convert to optimized format
      await sharp(inputPath)
        .resize(1200, 900, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(outputPath + '.tmp');

      // Replace original with optimized version
      fs.renameSync(outputPath + '.tmp', outputPath);

      // Add metadata
      galleryMetadata.push({
        filename: imageFile,
        uploadedAt: uploadedAt,
        display_name: imageFile.replace(/\.(jpeg|jpg)$/i, '').replace(/image/, 'Watch ').replace(/eitan1/, 'Eitan\'s Custom Build')
      });

      console.log(`✓ Optimized ${imageFile}`);
    } catch (error) {
      console.error(`✗ Error optimizing ${imageFile}:`, error.message);
    }
  }

  // Sort by most recently added (newest first)
  galleryMetadata.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  // Save metadata
  const metadataPath = path.join(__dirname, 'gallery-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(galleryMetadata, null, 2));
  console.log(`\n✓ Gallery metadata saved to gallery-metadata.json`);
  console.log(`✓ Total images processed: ${galleryMetadata.length}`);
}

optimizeImages().catch(error => {
  console.error('Optimization failed:', error);
  process.exit(1);
});
