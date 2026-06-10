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
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;');
    };

    const renderDialImageBlock = (dialImage) => {
        if (!dialImage) return '';

        const isDataUri = typeof dialImage === 'string' && dialImage.startsWith('data:');

        if (isDataUri) {
            return `
                <div class="custom-image">
                    <strong>Dial Image:</strong><br>
                    <img src="${dialImage}" alt="Custom dial image preview" style="max-width: 300px; margin-top: 8px; border-radius: 6px; border: 1px solid #ddd;">
                    <div class="submission-actions" style="margin-top: 10px;">
                        <a href="${dialImage}" download="dial-image" class="download-btn" style="padding: 6px 12px; background:#2f4ae8; color:white; border-radius:4px; text-decoration:none; font-size:13px;">Download</a>
                    </div>
                </div>
            `;
        }

        // Not a data URI: treat as a URL/path, show as text and provide download.
        return `
            <div class="custom-image">
                <strong>Dial Image:</strong><br>
                <span>${escapeHtml(dialImage)}</span>
                <div class="submission-actions" style="margin-top: 10px;">
                    <a href="${escapeHtml(dialImage)}" target="_blank" rel="noopener" class="download-btn" style="padding: 6px 12px; background:#2f4ae8; color:white; border-radius:4px; text-decoration:none; font-size:13px;">View / Download</a>
                </div>
            </div>
        `;
    };

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
            return;
        }

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

    // Expose functions globally
    window.logout = logout;

    window.filterSubmissions = function (filter) {
        currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        renderSubmissions();
    };

    window.updateStatus = async function (submissionId, newStatus) {
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

    window.deleteSubmission = async function (submissionId) {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(`/admin/api/submissions/${submissionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete submission');
            }

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

    // -----------------
    // Existing gallery/comments/optimize code was previously in admin.js.
    // If your current project relies on those, paste that part back in here.
    // -----------------
});

