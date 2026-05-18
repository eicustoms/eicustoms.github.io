require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const submissionsFile = path.join(__dirname, 'submissions.json');
const galleryMetadataFile = path.join(__dirname, 'gallery-metadata.json');
const commentsFile = path.join(__dirname, 'homepage-comments.json');
const imagesDir = path.join(__dirname, 'images');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Change this!
//console.log('Admin password:', ADMIN_PASSWORD);

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  }
});
// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper function to send email
const sendEmail = async (submission) => {
  if (!process.env.EMAIL_USER) {
    console.log('Email not configured. Skipping email notification.');
    return;
  }

  const emailContent = `
New Contact Form Submission

Name: ${submission.name}
Email: ${submission.email}
Phone: ${submission.phone}
Message: ${submission.message}

Custom Watch Details:
Case: ${submission.custom_case || 'N/A'}
Bezel: ${submission.custom_bezel || 'N/A'}
Dial: ${submission.custom_dial || 'N/A'}
Strap: ${submission.custom_strap || 'N/A'}
Summary: ${submission.custom_summary || 'N/A'}

Received at: ${submission.receivedAt}
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `New Contact Form: ${submission.name}`,
      text: emailContent
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

app.post('/api/contact', (req, res) => {
  const submission = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    ...req.body,
    receivedAt: new Date().toISOString(),
    status: 'pending'
  };

  let submissions = [];
  try {
    if (fs.existsSync(submissionsFile)) {
      const raw = fs.readFileSync(submissionsFile, 'utf8');
      submissions = raw ? JSON.parse(raw) : [];
    }
  } catch (error) {
    console.error('Failed to read submissions file:', error);
  }

  submissions.push(submission);

  try {
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));
  } catch (error) {
    console.error('Failed to write submissions file:', error);
    return res.status(500).json({ status: 'error', message: 'Unable to save submission' });
  }

  console.log('New contact submission:', submission);
  
  // Send email notification
  sendEmail(submission);

  res.json({ status: 'ok' });
});

// Protected admin login endpoint
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    res.json({ status: 'ok', token: 'authenticated' });
  } else {
    res.status(401).json({ status: 'error', message: 'Invalid password' });
  }
});

// Protected admin submissions endpoint
app.get('/admin/api/submissions', (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (fs.existsSync(submissionsFile)) {
      const raw = fs.readFileSync(submissionsFile, 'utf8');
      const submissions = raw ? JSON.parse(raw) : [];
      res.json(submissions);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to load submissions:', error);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

// Update submission status
app.patch('/admin/api/submissions/:id', (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    let submissions = [];
    if (fs.existsSync(submissionsFile)) {
      const raw = fs.readFileSync(submissionsFile, 'utf8');
      submissions = raw ? JSON.parse(raw) : [];
    }

    const submissionIndex = submissions.findIndex(s => s.id === id);
    if (submissionIndex === -1) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    submissions[submissionIndex].status = status;
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));

    res.json({ status: 'ok', submission: submissions[submissionIndex] });
  } catch (error) {
    console.error('Failed to update submission:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// Delete submission
app.delete('/admin/api/submissions/:id', (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    let submissions = [];
    if (fs.existsSync(submissionsFile)) {
      const raw = fs.readFileSync(submissionsFile, 'utf8');
      submissions = raw ? JSON.parse(raw) : [];
    }

    const submissionIndex = submissions.findIndex(s => s.id === id);
    if (submissionIndex === -1) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const deletedSubmission = submissions.splice(submissionIndex, 1);
    fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));

    console.log('Deleted submission:', deletedSubmission[0].name);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to delete submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Homepage comments endpoints
app.get('/api/comments', (req, res) => {
  try {
    const comments = fs.existsSync(commentsFile)
      ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
      : [];
    res.json(comments);
  } catch (error) {
    console.error('Failed to load homepage comments:', error);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.get('/admin/api/comments', (req, res) => {
  const token = req.headers.authorization;
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const comments = fs.existsSync(commentsFile)
      ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
      : [];
    res.json(comments);
  } catch (error) {
    console.error('Failed to load admin comments:', error);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

const processCommentImageUpload = async (file) => {
  if (!file) return null;
  const filename = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 8)}.jpg`;
  const filepath = path.join(imagesDir, filename);

  await sharp(file.buffer)
    .resize(400, 400, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80, progressive: true })
    .toFile(filepath);

  return `images/${filename}`;
};

app.post('/admin/api/comments', (req, res) => {
  const token = req.headers.authorization;
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const handleRequest = async () => {
    const { author, service, image, content } = req.body;
    if (!author || !content) {
      return res.status(400).json({ error: 'Author and content are required' });
    }

    try {
      const comments = fs.existsSync(commentsFile)
        ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
        : [];

      const uploadedImagePath = req.file ? await processCommentImageUpload(req.file) : null;
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        author: author.trim(),
        service: service ? service.trim() : '',
        image: uploadedImagePath || (image ? image.trim() : ''),
        content: content.trim(),
        createdAt: new Date().toISOString()
      };

      comments.unshift(newComment);
      fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
      res.json({ status: 'ok', comment: newComment });
    } catch (error) {
      console.error('Failed to save comment:', error);
      res.status(500).json({ error: 'Failed to save comment' });
    }
  };

  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    upload.single('imageFile')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      handleRequest();
    });
  } else {
    handleRequest();
  }
});

app.patch('/admin/api/comments/:id', (req, res) => {
  const token = req.headers.authorization;
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  const handleRequest = async () => {
    const { author, service, image, content } = req.body;

    try {
      const comments = fs.existsSync(commentsFile)
        ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
        : [];

      const index = comments.findIndex(comment => comment.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const uploadedImagePath = req.file ? await processCommentImageUpload(req.file) : null;
      comments[index] = {
        ...comments[index],
        author: author ? author.trim() : comments[index].author,
        service: service !== undefined ? service.trim() : comments[index].service,
        image: uploadedImagePath || (image !== undefined ? image.trim() : comments[index].image),
        content: content ? content.trim() : comments[index].content
      };

      fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
      res.json({ status: 'ok', comment: comments[index] });
    } catch (error) {
      console.error('Failed to update comment:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  };

  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('multipart/form-data')) {
    upload.single('imageFile')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      handleRequest();
    });
  } else {
    handleRequest();
  }
});

app.delete('/admin/api/comments/:id', (req, res) => {
  const token = req.headers.authorization;
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const comments = fs.existsSync(commentsFile)
      ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
      : [];

    const filtered = comments.filter(comment => comment.id !== id);
    if (filtered.length === comments.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    fs.writeFileSync(commentsFile, JSON.stringify(filtered, null, 2));
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to delete comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Gallery API Endpoints

// Get all gallery images metadata
app.get('/admin/api/gallery', (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (fs.existsSync(galleryMetadataFile)) {
      const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
      const metadata = raw ? JSON.parse(raw) : [];
      res.json(metadata);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to load gallery metadata:', error);
    res.status(500).json({ error: 'Failed to load gallery metadata' });
  }
});

// Get all gallery images (public - for gallery page)
app.get('/api/gallery', (req, res) => {
  try {
    if (fs.existsSync(galleryMetadataFile)) {
      const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
      const metadata = raw ? JSON.parse(raw) : [];
      res.json(metadata);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to load gallery metadata:', error);
    res.status(500).json({ error: 'Failed to load gallery metadata' });
  }
});

// Upload a new gallery image
app.post('/admin/api/gallery/upload', upload.single('image'), async (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `gallery-${timestamp}.jpg`;
    const filepath = path.join(imagesDir, filename);

    // Optimize and save the image
    await sharp(req.file.buffer)
      .resize(1200, 900, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80, progressive: true })
      .toFile(filepath);

    // Get display name from request or use default
    const displayName = req.body.displayName || filename.replace(/\.(jpg|jpeg)$/i, '').replace('gallery-', 'Custom Watch ');

    // Add to metadata
    let metadata = [];
    if (fs.existsSync(galleryMetadataFile)) {
      const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
      metadata = raw ? JSON.parse(raw) : [];
    }

    const newImage = {
      filename: filename,
      uploadedAt: new Date().toISOString(),
      display_name: displayName
    };

    // Add to beginning (most recent first)
    metadata.unshift(newImage);
    fs.writeFileSync(galleryMetadataFile, JSON.stringify(metadata, null, 2));

    res.json({ status: 'ok', image: newImage });
  } catch (error) {
    console.error('Failed to upload image:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
});

// Delete a gallery image
app.delete('/admin/api/gallery/:filename', (req, res) => {
  const token = req.headers.authorization;
  
  if (token !== `Bearer authenticated`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { filename } = req.params;
  
  try {
    const filepath = path.join(imagesDir, filename);

    // Check if file exists and is in the gallery folder
    if (!filepath.startsWith(imagesDir) || !fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete the file
    fs.unlinkSync(filepath);

    // Remove from metadata
    let metadata = [];
    if (fs.existsSync(galleryMetadataFile)) {
      const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
      metadata = raw ? JSON.parse(raw) : [];
    }

    metadata = metadata.filter(img => img.filename !== filename);
    fs.writeFileSync(galleryMetadataFile, JSON.stringify(metadata, null, 2));

    console.log(`Deleted gallery image: ${filename}`);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.EMAIL_USER) {
    console.log('⚠️  Email notifications not configured. Set EMAIL_USER and EMAIL_PASSWORD env vars.');
  }
});
