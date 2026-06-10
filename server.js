require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sharp = require('sharp');
const { pool, initDb } = require('./db');
const {
  setPool,
  getOptimizeCandidates,
  optimizeSingleImage,
  deoptimizeSingleImage,
  optimizeActiveImages,
  addOptimizeImage,
  updateOptimizeImage
} = require('./optimize-images');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const submissionsFile = path.join(dataDir, 'submissions.json');
const galleryMetadataFile = path.join(dataDir, 'gallery-metadata.json');
const commentsFile = path.join(dataDir, 'homepage-comments.json');
const imagesDir = path.join(dataDir, 'images');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Change this!
const ADMIN_SESSION_COOKIE = 'adminSession';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';

const ensureDataPaths = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
};

ensureDataPaths();

// Initialize database if DATABASE_URL is set
const initializeApp = async () => {
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      setPool(pool);
      await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS custom_dialImage TEXT`);
      console.log('✓ Database initialized');
    } catch (error) {
      console.error('Database initialization failed:', error);
      process.exit(1);
    }
  } else {
    console.log('⚠️  DATABASE_URL not set. Using file-based storage.');
  }
};

initializeApp();


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
app.use('/images', express.static(imagesDir));
app.use(express.static(path.join(__dirname)));

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((cookies, pair) => {
    const [name, ...value] = pair.trim().split('=');
    if (!name || value.length === 0) return cookies;
    cookies[name] = decodeURIComponent(value.join('='));
    return cookies;
  }, {});
};

const signPayload = (payload) => {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
};

const createSessionToken = () => {
  const payload = JSON.stringify({ exp: Date.now() + COOKIE_MAX_AGE });
  const encoded = Buffer.from(payload, 'utf8').toString('base64');
  return `${encoded}.${signPayload(encoded)}`;
};

const verifySessionToken = (token) => {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, signature] = parts;
  if (signPayload(encoded) !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return payload.exp && payload.exp > Date.now();
  } catch (err) {
    return false;
  }
};

const getSessionTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[ADMIN_SESSION_COOKIE];
};

const requireAdminSession = (req, res, next) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.redirect('/admin/login');
  }
  next();
};

const requireAdminApiAuth = (req, res, next) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

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

const DATA_URI_MAX_CHARS = 2_500_000; // tweak as needed (characters in the data URI string)

function isDataUri(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function dataUriToBuffer(dataUri) {
  // data:[mime];base64,<base64>
  const base64 = dataUri.split(',')[1] || '';
  return Buffer.from(base64, 'base64');
}

async function compressDialImageIfNeeded(dialImageDataUri) {
  if (!isDataUri(dialImageDataUri)) return dialImageDataUri;

  const mime = dialImageDataUri.split(';')[0].slice('data:'.length); // e.g. image/jpeg, image/png, image/gif

  // Skip GIF
  if (mime === 'image/gif') return dialImageDataUri;

  // Only attempt compression for JPEG/PNG
  if (mime !== 'image/jpeg' && mime !== 'image/png') return dialImageDataUri;

  // If not too large, keep original
  if (dialImageDataUri.length <= DATA_URI_MAX_CHARS) return dialImageDataUri;

  const inputBuffer = dataUriToBuffer(dialImageDataUri);

  // Heuristic: resize down and re-encode as JPEG progressive
  // (Prevents giant base64 strings from being stored/rendered)
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, progressive: true })
    .toBuffer();

  const outputBase64 = outputBuffer.toString('base64');
  return `data:image/jpeg;base64,${outputBase64}`;
}

app.post('/api/contact', async (req, res) => {
  const submission = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    ...req.body,
    receivedAt: new Date().toISOString(),
    status: 'pending'
  };

  // Backend compatibility: normalize dial image into custom_dialImage
  if (!submission.custom_dialImage) {
    submission.custom_dialImage =
      (submission.custom_fields && submission.custom_fields.dialImage) ||
      submission.dialImage ||
      submission.quote_dialImageData ||
      submission.quote_dialImage;
  }

    try {
    if (submission.custom_dialImage) {
      submission.custom_dialImage = await compressDialImageIfNeeded(submission.custom_dialImage);
    }
  } catch (e) {
    console.error('Dial image compression failed; saving original:', e.message);
  }

  try {
    if (pool) {
      // Use database
      await pool.query(
        `INSERT INTO submissions (id, name, email, phone, message, custom_case, custom_bezel, custom_dial, custom_strap, custom_dialImage, custom_summary, received_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [submission.id, submission.name, submission.email, submission.phone, submission.message,
         submission.custom_case, submission.custom_bezel, submission.custom_dial, submission.custom_strap,
         submission.custom_dialImage, submission.custom_summary, submission.receivedAt, submission.status]
      );
    } else {
      // Fallback to file-based storage
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
      fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));
    }
  } catch (error) {
    console.error('Failed to save submission:', error);
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
    const token = createSessionToken();
    res.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });
    return res.json({ status: 'ok' });
  }

  res.status(401).json({ status: 'error', message: 'Invalid password' });
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
  res.json({ status: 'ok' });
});

app.get('/admin', requireAdminSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.use('/admin/api', requireAdminApiAuth);

// Protected admin submissions endpoint
app.get('/admin/api/submissions', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (pool) {
      // Use database
      const result = await pool.query('SELECT * FROM submissions ORDER BY received_at DESC');
      res.json(result.rows);
    } else {
      // Fallback to file-based storage
      if (fs.existsSync(submissionsFile)) {
        const raw = fs.readFileSync(submissionsFile, 'utf8');
        const submissions = raw ? JSON.parse(raw) : [];
        res.json(submissions);
      } else {
        res.json([]);
      }
    }
  } catch (error) {
    console.error('Failed to load submissions:', error);
    res.status(500).json({ error: 'Failed to load submissions' });
  }
});

// Update submission status
app.patch('/admin/api/submissions/:id', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    if (pool) {
      // Use database
      const result = await pool.query(
        'UPDATE submissions SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      res.json({ status: 'ok', submission: result.rows[0] });
    } else {
      // Fallback to file-based storage
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
    }
  } catch (error) {
    console.error('Failed to update submission:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// Delete submission
app.delete('/admin/api/submissions/:id', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    if (pool) {
      // Use database
      const result = await pool.query(
        'DELETE FROM submissions WHERE id = $1 RETURNING name',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      console.log('Deleted submission:', result.rows[0].name);
      res.json({ status: 'ok' });
    } else {
      // Fallback to file-based storage
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
    }
  } catch (error) {
    console.error('Failed to delete submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

// Serve admin page
app.get('/admin', requireAdminSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Homepage comments endpoints
app.get('/api/comments', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM comments ORDER BY created_at DESC');
      res.json(result.rows);
    } else {
      const comments = fs.existsSync(commentsFile)
        ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
        : [];
      res.json(comments);
    }
  } catch (error) {
    console.error('Failed to load homepage comments:', error);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.get('/admin/api/comments', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM comments ORDER BY created_at DESC');
      res.json(result.rows);
    } else {
      const comments = fs.existsSync(commentsFile)
        ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
        : [];
      res.json(comments);
    }
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
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const handleRequest = async () => {
    const { author, service, image, content } = req.body;
    if (!author || !content) {
      return res.status(400).json({ error: 'Author and content are required' });
    }

    try {
      const uploadedImagePath = req.file ? await processCommentImageUpload(req.file) : null;
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        author: author.trim(),
        service: service ? service.trim() : '',
        image: uploadedImagePath || (image ? image.trim() : ''),
        content: content.trim(),
        createdAt: new Date().toISOString()
      };

      if (pool) {
        // Use database
        await pool.query(
          `INSERT INTO comments (id, author, service, image, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newComment.id, newComment.author, newComment.service, newComment.image, newComment.content, newComment.createdAt]
        );
      } else {
        // Fallback to file-based storage
        const comments = fs.existsSync(commentsFile)
          ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
          : [];
        comments.unshift(newComment);
        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
      }

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
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  const handleRequest = async () => {
    const { author, service, image, content } = req.body;

    try {
      const uploadedImagePath = req.file ? await processCommentImageUpload(req.file) : null;

      if (pool) {
        // Use database
        const result = await pool.query(
          `UPDATE comments SET author = $1, service = $2, image = COALESCE($3, image), content = $4
           WHERE id = $5 RETURNING *`,
          [author || undefined, service, uploadedImagePath || (image !== undefined ? image : undefined), content, id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Comment not found' });
        }
        res.json({ status: 'ok', comment: result.rows[0] });
      } else {
        // Fallback to file-based storage
        const comments = fs.existsSync(commentsFile)
          ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
          : [];

        const index = comments.findIndex(comment => comment.id === id);
        if (index === -1) {
          return res.status(404).json({ error: 'Comment not found' });
        }

        comments[index] = {
          ...comments[index],
          author: author ? author.trim() : comments[index].author,
          service: service !== undefined ? service.trim() : comments[index].service,
          image: uploadedImagePath || (image !== undefined ? image.trim() : comments[index].image),
          content: content ? content.trim() : comments[index].content
        };

        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
        res.json({ status: 'ok', comment: comments[index] });
      }
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

app.delete('/admin/api/comments/:id', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    if (pool) {
      // Use database
      const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      res.json({ status: 'ok' });
    } else {
      // Fallback to file-based storage
      const comments = fs.existsSync(commentsFile)
        ? JSON.parse(fs.readFileSync(commentsFile, 'utf8'))
        : [];

      const filtered = comments.filter(comment => comment.id !== id);
      if (filtered.length === comments.length) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      fs.writeFileSync(commentsFile, JSON.stringify(filtered, null, 2));
      res.json({ status: 'ok' });
    }
  } catch (error) {
    console.error('Failed to delete comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Gallery API Endpoints

// Get all gallery images metadata
app.get('/admin/api/gallery', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM gallery_metadata ORDER BY uploaded_at DESC');
      res.json(result.rows);
    } else {
      if (fs.existsSync(galleryMetadataFile)) {
        const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
        const metadata = raw ? JSON.parse(raw) : [];
        res.json(metadata);
      } else {
        res.json([]);
      }
    }
  } catch (error) {
    console.error('Failed to load gallery metadata:', error);
    res.status(500).json({ error: 'Failed to load gallery metadata' });
  }
});

app.get('/admin/api/optimize-images', (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    res.json({ images: getOptimizeCandidates() });
  } catch (error) {
    console.error('Failed to load optimization candidates:', error);
    res.status(500).json({ error: 'Failed to load optimization candidates' });
  }
});

app.post('/admin/api/optimize-images', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await optimizeActiveImages();
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Image optimization failed:', error);
    res.status(500).json({ error: 'Image optimization failed' });
  }
});

app.post('/admin/api/optimize-images/upload', upload.single('image'), async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    const originalName = path.basename(req.file.originalname);
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const extension = path.extname(safeName).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (!allowed.includes(extension)) {
      return res.status(400).json({ error: 'Only JPG and PNG images are allowed' });
    }

    let filename = safeName;
    let targetPath = path.join(imagesDir, filename);
    let suffix = 1;
    while (fs.existsSync(targetPath)) {
      filename = `${path.basename(safeName, extension)}-${suffix}${extension}`;
      targetPath = path.join(imagesDir, filename);
      suffix += 1;
    }

    fs.writeFileSync(targetPath, req.file.buffer);
    const description = req.body.description ? req.body.description.trim() : '';
    const active = req.body.active !== 'false';
    await addOptimizeImage(filename, description, active);

    if (active) {
      await optimizeSingleImage(filename);
    }

    res.json({ status: 'ok', filename });
  } catch (error) {
    console.error('Image upload optimization failed:', error);
    res.status(500).json({ error: 'Image upload optimization failed' });
  }
});

app.patch('/admin/api/optimize-images/:filename', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filename = path.basename(req.params.filename);
  const { active, description } = req.body;

  try {
    const updated = updateOptimizeImage(filename, {
      active: typeof active === 'boolean' ? active : undefined,
      description: typeof description === 'string' ? description : undefined
    });

    if (updated.active) {
      await optimizeSingleImage(filename);
    }

    res.json({ status: 'ok', image: updated });
  } catch (error) {
    console.error('Failed to update optimizer entry:', error);
    res.status(500).json({ error: error.message || 'Failed to update optimizer entry' });
  }
});

app.post('/admin/api/optimize-images/:filename/optimize', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filename = path.basename(req.params.filename);

  try {
    await optimizeSingleImage(filename);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to optimize image:', error);
    res.status(500).json({ error: error.message || 'Failed to optimize image' });
  }
});

app.post('/admin/api/optimize-images/:filename/deoptimize', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const filename = path.basename(req.params.filename);

  try {
    await deoptimizeSingleImage(filename);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to deoptimize image:', error);
    res.status(500).json({ error: error.message || 'Failed to deoptimize image' });
  }
});

// Get all gallery images (public - for gallery page)
app.get('/api/gallery', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM gallery_metadata ORDER BY uploaded_at DESC');
      res.json(result.rows);
    } else {
      if (fs.existsSync(galleryMetadataFile)) {
        const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
        const metadata = raw ? JSON.parse(raw) : [];
        res.json(metadata);
      } else {
        res.json([]);
      }
    }
  } catch (error) {
    console.error('Failed to load gallery metadata:', error);
    res.status(500).json({ error: 'Failed to load gallery metadata' });
  }
});

// Upload a new gallery image
app.post('/admin/api/gallery/upload', upload.single('image'), async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
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
    const uploadedAt = new Date().toISOString();

    // Add to database or file
    if (pool) {
      await pool.query(
        `INSERT INTO gallery_metadata (filename, display_name, uploaded_at)
         VALUES ($1, $2, $3)`,
        [filename, displayName, uploadedAt]
      );
    } else {
      let metadata = [];
      if (fs.existsSync(galleryMetadataFile)) {
        const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
        metadata = raw ? JSON.parse(raw) : [];
      }
      metadata.unshift({ filename, display_name: displayName, uploadedAt });
      fs.writeFileSync(galleryMetadataFile, JSON.stringify(metadata, null, 2));
    }

    const newImage = {
      filename: filename,
      uploadedAt: uploadedAt,
      display_name: displayName
    };

    res.json({ status: 'ok', image: newImage });
  } catch (error) {
    console.error('Failed to upload image:', error);
    res.status(500).json({ error: 'Failed to upload image: ' + error.message });
  }
});

// Delete a gallery image
app.delete('/admin/api/gallery/:filename', async (req, res) => {
  if (!verifySessionToken(getSessionTokenFromRequest(req))) {
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

    // Remove from database or file
    if (pool) {
      await pool.query('DELETE FROM gallery_metadata WHERE filename = $1', [filename]);
    } else {
      let metadata = [];
      if (fs.existsSync(galleryMetadataFile)) {
        const raw = fs.readFileSync(galleryMetadataFile, 'utf8');
        metadata = raw ? JSON.parse(raw) : [];
      }
      metadata = metadata.filter(img => img.filename !== filename);
      fs.writeFileSync(galleryMetadataFile, JSON.stringify(metadata, null, 2));
    }

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

