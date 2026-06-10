document.addEventListener('DOMContentLoaded', () => {
    const adminPanel = document.getElementById('adminPanel');
    const submissionsContainer = document.getElementById('submissionsContainer');
    const logoutButton = document.getElementById('logoutButton');

    if (adminPanel) {
        adminPanel.classList.remove('hidden');
    }

    let allSubmissions = [];
    let currentFilter = 'all';

    const escapeHtml = text => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    function renderDialImageBlock(dialImage) {
  if (!dialImage) return '';

  const isDataUri = typeof dialImage === 'string' && dialImage.startsWith('data:image/');

  if (isDataUri) {
    return `
      <div class="custom-image">
        <strong>Dial Image:</strong><br>
        <img src="${dialImage}" alt="Custom dial image preview"
             style="max-width: 300px; margin-top: 8px; border-radius: 6px; border: 1px solid #ddd;">
        <div class="submission-actions" style="margin-top: 10px;">
          <a href="${dialImage}" download="dial-image"
             style="padding: 6px 12px; background:#2f4ae8; color:white; border-radius:4px; text-decoration:none; font-size:13px;">
             Download
          </a>
        </div>
    `;
  }

  // If it's not a data URI, treat it as a URL/path (may not work if it's not a real URL)
  return `
    <div class="custom-image">
      <strong>Dial Image:</strong><br>
      <span>${escapeHtml(dialImage)}</span>
      <div class="submission-actions" style="margin-top: 10px;">
        <a href="${escapeHtml(dialImage)}" target="_blank" rel="noopener"
           style="padding: 6px 12px; background:#2f4ae8; color:white; border-radius:4px; text-decoration:none; font-size:13px;">
          View / Download
        </a>
      </div>
  `;
}

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await fetch('/admin/logout', { method: 'POST' });
            } catch (error) {
                console.error('Logout error:', error);
            }
            window.location.href = '/admin/login';
        });
    }

    async function logout() {
        try {
            await fetch('/admin/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.href = '/admin/login';
    }

    async function loadSubmissions() {
        try {
            const response = await fetch('/admin/api/submissions');

            if (!response.ok) {
                if (response.status === 401) {
                    return window.location.href = '/admin/login';
                }
                throw new Error('Failed to load submissions');
            }

            allSubmissions = await response.json();
            updateStats();
            renderSubmissions();
        } catch (error) {
            submissionsContainer.innerHTML = `<div class="no-submissions">Error loading submissions: ${error.message}</div>`;
            console.error('Load error:', error);
        }
    }

    loadSubmissions();

    function updateStats() {
        const total = allSubmissions.length;
        const pending = allSubmissions.filter(s => !s.status || s.status === 'pending').length;
        const inProgress = allSubmissions.filter(s => s.status === 'in-progress').length;
        const completed = allSubmissions.filter(s => s.status === 'completed').length;

        document.getElementById('totalCount').textContent = total;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('inProgressCount').textContent = inProgress;
        document.getElementById('completedCount').textContent = completed;
    }

    function renderSubmissions() {
        let toRender = allSubmissions;

        if (currentFilter !== 'all') {
            toRender = allSubmissions.filter(s => {
                const status = s.status || 'pending';
                return status === currentFilter;
            });
        }

        if (toRender.length === 0) {
            submissionsContainer.innerHTML = '<div class="no-submissions">No submissions yet.</div>';
        } else {
            submissionsContainer.innerHTML = toRender.map(submission => {
                const status = submission.status || 'pending';
                return `
                    <div class="submission">
                        <div class="status-badge ${status}">${status.replace('-', ' ').toUpperCase()}</div>
                        <h3>${escapeHtml(submission.name)}</h3>
                        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></p>
                        <p><strong>Phone:</strong> ${escapeHtml(submission.phone || 'N/A')}</p>
                        <p><strong>Message:</strong> ${escapeHtml(submission.message)}</p>
                        ${submission.custom_summary ? `
                            <div class="custom-details">
                                <strong>Watch Design:</strong><br>
                                ${escapeHtml(submission.custom_summary)}
                            </div>
                        ` : ''}
                        ${renderDialImageBlock(submission.custom_dialImage)}

                        <p class="timestamp">Received: ${new Date(submission.receivedAt).toLocaleString()}</p>
                        
                        <div class="submission-actions">
                            <select class="status-select" onchange="updateStatus('${submission.id}', this.value)">
                                <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="in-progress" ${status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                            </select>
                            <button class="delete-btn" onclick="deleteSubmission('${submission.id}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Expose functions globally
    window.logout = logout;
    window.filterSubmissions = function(filter) {
        currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        renderSubmissions();
    };

    window.updateStatus = async function(submissionId, newStatus) {
        try {
            const response = await fetch(`/admin/api/submissions/${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) {
                alert('Failed to update status');
                return;
            }

            loadSubmissions();
        } catch (error) {
            alert('Error updating status: ' + error.message);
            console.error('Error:', error);
        }
    };

    window.deleteSubmission = async function(submissionId) {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(`/admin/api/submissions/${submissionId}`, {
                method: 'DELETE'
            });

            /*if (!response.ok) {
                alert('Failed to delete submission');
                return;
            }*/

            loadSubmissions();
        } catch (error) {
            alert('Error deleting submission: ' + error.message);
            console.error('Error:', error);
        }
    };

    // Refresh submissions every 30 seconds
    setInterval(() => {
        if (!adminPanel.classList.contains('hidden')) {
            loadSubmissions();
        }
    }, 30000);

    // Gallery Management
    const galleryUploadForm = document.getElementById('galleryUploadForm');

    const galleryContainer = document.getElementById('galleryContainer');
    const uploadStatus = document.getElementById('uploadStatus');
    let allGalleryImages = [];
    let allComments = [];

    const commentForm = document.getElementById('commentForm');
    const commentList = document.getElementById('commentList');
    const commentStatus = document.getElementById('commentStatus');
    const optimizeStatus = document.getElementById('optimizeStatus');
    const optimizeList = document.getElementById('optimizeList');
    const optimizeButton = document.getElementById('optimizeImagesBtn');
    const optimizeUploadForm = document.getElementById('optimizeUploadForm');
    const optimizeUploadFile = document.getElementById('optimizeUploadFile');
    const optimizeUploadDescription = document.getElementById('optimizeUploadDescription');

    // Load gallery and comments on panel show
    loadGalleryImages();
    loadComments();
    loadOptimizeTargets();

    galleryUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadGalleryImage();
    });

    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addComment();
    });

    optimizeUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadOptimizeImage();
    });

    optimizeButton.addEventListener('click', async () => {
        await runOptimizeImages();
    });

    async function loadComments() {
        try {
            const response = await fetch('/admin/api/comments', {
                            });

            if (!response.ok) {
                throw new Error('Failed to load comments');
            }

            allComments = await response.json();
            renderComments();
        } catch (error) {
            console.error('Comments load error:', error);
            commentList.innerHTML = `<div class="no-gallery-items">Error loading comments: ${error.message}</div>`;
        }
    }

    function renderComments() {
        if (allComments.length === 0) {
            commentList.innerHTML = '<div class="no-gallery-items">No comments yet.</div>';
            return;
        }

        commentList.innerHTML = allComments.map(comment => `
            <div class="comment-card">
                <h3>${escapeHtml(comment.author)}</h3>
                <label>Name</label>
                <input id="commentAuthor-${escapeHtml(comment.id)}" value="${escapeHtml(comment.author)}" type="text">
                <label>Service</label>
                <input id="commentService-${escapeHtml(comment.id)}" value="${escapeHtml(comment.service)}" type="text">
                <label>Image URL (optional)</label>
                <input id="commentImage-${escapeHtml(comment.id)}" value="${escapeHtml(comment.image || '')}" type="text">
                <label>Upload New Image (optional)</label>
                <input id="commentImageFile-${escapeHtml(comment.id)}" type="file" accept="image/jpeg,image/png,image/jpg">
                <label>Quote</label>
                <textarea id="commentContent-${escapeHtml(comment.id)}">${escapeHtml(comment.content)}</textarea>
                <div class="comment-actions">
                    <button type="button" class="save-comment" onclick="saveComment('${escapeHtml(comment.id)}')">Save</button>
                    <button type="button" class="delete-comment" onclick="deleteComment('${escapeHtml(comment.id)}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async function addComment() {
        const author = document.getElementById('commentAuthor').value.trim();
        const service = document.getElementById('commentService').value.trim();
        const image = document.getElementById('commentImage').value.trim();
        const imageFile = document.getElementById('commentImageFile').files[0];
        const content = document.getElementById('commentContent').value.trim();

        if (!author || !content) {
            showCommentStatus('Name and quote are required.', 'error');
            return;
        }

        try {
            let options;
            if (imageFile) {
                const formData = new FormData();
                formData.append('author', author);
                formData.append('service', service);
                formData.append('image', image);
                formData.append('content', content);
                formData.append('imageFile', imageFile);
                options = {
                    method: 'POST',
                    body: formData
                };
            } else {
                options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ author, service, image, content })
                };
            }

            const response = await fetch('/admin/api/comments', options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save comment');
            }

            document.getElementById('commentAuthor').value = '';
            document.getElementById('commentService').value = '';
            document.getElementById('commentImage').value = '';
            document.getElementById('commentImageFile').value = '';
            document.getElementById('commentContent').value = '';
            showCommentStatus('Comment added successfully.', 'success');
            loadComments();
        } catch (error) {
            console.error('Add comment error:', error);
            showCommentStatus(`Error: ${error.message}`, 'error');
        }
    }

    window.saveComment = async function(id) {
        const author = document.getElementById(`commentAuthor-${id}`).value.trim();
        const service = document.getElementById(`commentService-${id}`).value.trim();
        const image = document.getElementById(`commentImage-${id}`).value.trim();
        const imageFile = document.getElementById(`commentImageFile-${id}`).files[0];
        const content = document.getElementById(`commentContent-${id}`).value.trim();

        try {
            let options;
            if (imageFile) {
                const formData = new FormData();
                formData.append('author', author);
                formData.append('service', service);
                formData.append('image', image);
                formData.append('content', content);
                formData.append('imageFile', imageFile);
                options = {
                    method: 'PATCH',
                    body: formData
                };
            } else {
                options = {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ author, service, image, content })
                };
            }

            const response = await fetch(`/admin/api/comments/${id}`, options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save comment');
            }

            showCommentStatus('Comment saved successfully.', 'success');
            loadComments();
        } catch (error) {
            console.error('Save comment error:', error);
            showCommentStatus(`Error: ${error.message}`, 'error');
        }
    };

    window.deleteComment = async function(id) {
        if (!confirm('Delete this comment? This cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(`/admin/api/comments/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete comment');
            }

            showCommentStatus('Comment deleted.', 'success');
            loadComments();
        } catch (error) {
            console.error('Delete comment error:', error);
            showCommentStatus(`Error: ${error.message}`, 'error');
        }
    };

    function showCommentStatus(message, type) {
        commentStatus.textContent = message;
        commentStatus.className = `upload-status show ${type}`;
        setTimeout(() => {
            commentStatus.classList.remove('show');
        }, 5000);
    }

    async function loadGalleryImages() {
        try {
            const response = await fetch('/admin/api/gallery', {
                            });

            if (!response.ok) {
                throw new Error('Failed to load gallery images');
            }

            allGalleryImages = await response.json();
            renderGalleryImages();
        } catch (error) {
            console.error('Gallery load error:', error);
            galleryContainer.innerHTML = `<div class="no-gallery-items">Error loading gallery: ${error.message}</div>`;
        }
    }

    function renderGalleryImages() {
        if (allGalleryImages.length === 0) {
            galleryContainer.innerHTML = '<div class="no-gallery-items">No photos in gallery yet.</div>';
            return;
        }

        galleryContainer.innerHTML = allGalleryImages.map(img => `
            <div class="gallery-item-card">
                <img src="images/${escapeHtml(img.filename)}" alt="${escapeHtml(img.display_name)}" class="gallery-item-image">
                <div class="gallery-item-info">
                    <div>${escapeHtml(img.display_name)}</div>
                    <div style="font-size: 11px; color: #999;">${new Date(img.uploadedAt).toLocaleDateString()}</div>
                </div>
                <button class="gallery-item-delete" onclick="deleteGalleryImage('${escapeHtml(img.filename)}')">Delete</button>
            </div>
        `).join('');
    }

    async function uploadGalleryImage() {
        const fileInput = document.getElementById('galleryImage');
        const displayNameInput = document.getElementById('displayName');
        const uploadButton = galleryUploadForm.querySelector('button');

        if (!fileInput.files.length) {
            showUploadStatus('Please select an image', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        if (displayNameInput.value) {
            formData.append('displayName', displayNameInput.value);
        }

        uploadButton.disabled = true;

        try {
            const response = await fetch('/admin/api/gallery/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const result = await response.json();
            showUploadStatus('Photo uploaded successfully! Reloading admin panel...', 'success');
            fileInput.value = '';
            displayNameInput.value = '';
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            showUploadStatus(`Upload failed: ${error.message}`, 'error');
            console.error('Upload error:', error);
        } finally {
            uploadButton.disabled = false;
        }
    }

    function showUploadStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = `upload-status show ${type}`;
        setTimeout(() => {
            uploadStatus.classList.remove('show');
        }, 5000);
    }

    window.deleteGalleryImage = async function(filename) {
        if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(`/admin/api/gallery/${filename}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete photo');
            }

            loadGalleryImages();
        } catch (error) {
            alert('Error deleting photo: ' + error.message);
            console.error('Delete error:', error);
        }
    };

    async function loadOptimizeTargets() {
        try {
            const response = await fetch('/admin/api/optimize-images', {
                            });

            if (!response.ok) {
                throw new Error('Failed to load optimize targets');
            }

            const data = await response.json();
            renderOptimizeTargets(data);
        } catch (error) {
            optimizeList.textContent = `Unable to load optimization targets: ${error.message}`;
            console.error('Optimize target load error:', error);
        }
    }

    function renderOptimizeTargets(data) {
        // Normalize so `images.map(...)` never crashes
        let images = [];
        if (Array.isArray(data)) {
            images = data;
        } else if (data && Array.isArray(data.images)) {
            images = data.images;
        }


        if (images.length === 0) {
            optimizeList.innerHTML = '<div class="no-gallery-items">No optimization targets configured.</div>';
            return;
        }

        optimizeList.innerHTML = images.map(image => `
            <div class="optimize-target-row">
                <div class="optimize-target-meta">
                    <strong>${escapeHtml(image.filename)}</strong>
                    <div>${escapeHtml(image.description || 'No description')}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Status: ${image.active ? 'Active' : 'Inactive'}</div>
                </div>
                <div class="optimize-target-actions">
                    <label class="optimize-toggle">
                        <input type="checkbox" onchange="toggleOptimizeActive(${JSON.stringify(image.filename)}, this.checked)" ${image.active ? 'checked' : ''}>
                        Always optimize
                    </label>
                    <button type="button" class="optimize-btn" onclick="optimizeTargetNow(${JSON.stringify(image.filename)})">Optimize</button>
                    <button type="button" class="optimize-btn" onclick="deoptimizeTarget(${JSON.stringify(image.filename)})">Deoptimize</button>
                </div>
            </div>
        `).join('');
    }

    async function uploadOptimizeImage() {
        const file = optimizeUploadFile.files[0];
        const description = optimizeUploadDescription.value.trim();

        if (!file) {
            optimizeStatus.textContent = 'Please select an image to upload.';
            optimizeStatus.className = 'optimize-status show error';
            return;
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('description', description);

        optimizeStatus.textContent = 'Uploading image...';
        optimizeStatus.className = 'optimize-status show';
        try {
            const response = await fetch('/admin/api/optimize-images/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            optimizeStatus.textContent = 'Image uploaded and added to optimization list. Reloading admin panel...';
            optimizeStatus.className = 'optimize-status show success';
            optimizeUploadFile.value = '';
            optimizeUploadDescription.value = '';
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            optimizeStatus.textContent = `Upload error: ${error.message}`;
            optimizeStatus.className = 'optimize-status show error';
            console.error('Upload optimization image error:', error);
        }
    }

    window.toggleOptimizeActive = async function(filename, active) {
        try {
            const response = await fetch(`/admin/api/optimize-images/${encodeURIComponent(filename)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update optimization status');
            }

            loadOptimizeTargets();
        } catch (error) {
            optimizeStatus.textContent = `Update error: ${error.message}`;
            optimizeStatus.className = 'optimize-status show error';
            console.error('Toggle optimizer active error:', error);
        }
    }

    window.optimizeTargetNow = async function(filename) {
        optimizeStatus.textContent = `Optimizing ${filename}...`;
        optimizeStatus.className = 'optimize-status show';
        try {
            const response = await fetch(`/admin/api/optimize-images/${encodeURIComponent(filename)}/optimize`, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to optimize image');
            }

            optimizeStatus.textContent = `${filename} optimized successfully.`;
            optimizeStatus.className = 'optimize-status show success';
            loadOptimizeTargets();
        } catch (error) {
            optimizeStatus.textContent = `Optimize error: ${error.message}`;
            optimizeStatus.className = 'optimize-status show error';
            console.error('Optimize target error:', error);
        }
    };

    window.deoptimizeTarget = async function(filename) {
        optimizeStatus.textContent = `Restoring ${filename} from backup...`;
        optimizeStatus.className = 'optimize-status show';
        try {
            const response = await fetch(`/admin/api/optimize-images/${encodeURIComponent(filename)}/deoptimize`, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to deoptimize image');
            }

            optimizeStatus.textContent = `${filename} restored from backup.`;
            optimizeStatus.className = 'optimize-status show success';
            loadOptimizeTargets();
        } catch (error) {
            optimizeStatus.textContent = `Deoptimize error: ${error.message}`;
            optimizeStatus.className = 'optimize-status show error';
            console.error('Deoptimize target error:', error);
        }
    };

    async function runOptimizeImages() {
        optimizeButton.disabled = true;
        optimizeStatus.textContent = 'Running optimization for active images...';
        optimizeStatus.className = 'optimize-status show';

        try {
            const response = await fetch('/admin/api/optimize-images', {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Optimization failed');
            }

            optimizeStatus.textContent = 'Active images optimized successfully.';
            optimizeStatus.className = 'optimize-status show success';
            loadOptimizeTargets();
        } catch (error) {
            optimizeStatus.textContent = `Optimization error: ${error.message}`;
            optimizeStatus.className = 'optimize-status show error';
            console.error('Optimize error:', error);
        } finally {
            optimizeButton.disabled = false;
        }
    }

});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
