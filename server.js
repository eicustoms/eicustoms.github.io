require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const submissionsFile = path.join(__dirname, 'submissions.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this!

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (!process.env.EMAIL_USER) {
    console.log('⚠️  Email notifications not configured. Set EMAIL_USER and EMAIL_PASSWORD env vars.');
  }
});
