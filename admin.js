document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginContainer = document.getElementById('loginContainer');
    const adminPanel = document.getElementById('adminPanel');
    const submissionsContainer = document.getElementById('submissionsContainer');
    const loginError = document.getElementById('loginError');
    const passwordInput = document.getElementById('passwordInput');

    let allSubmissions = [];
    let currentFilter = 'all';

    // Check if already authenticated
    const token = localStorage.getItem('adminToken');
    if (token) {
        showAdminPanel();
        loadSubmissions();
    }

    // Handle login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;

        try {
            const response = await fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok && data.status === 'ok') {
                localStorage.setItem('adminToken', data.token);
                loginError.textContent = '';
                showAdminPanel();
                loadSubmissions();
            } else {
                loginError.textContent = 'Invalid password. Try again.';
                passwordInput.value = '';
            }
        } catch (error) {
            loginError.textContent = 'Login failed. Please try again.';
            console.error('Login error:', error);
        }
    });

    function showAdminPanel() {
        loginContainer.classList.add('hidden');
        adminPanel.classList.remove('hidden');
    }

    function logout() {
        localStorage.removeItem('adminToken');
        loginContainer.classList.remove('hidden');
        adminPanel.classList.add('hidden');
        passwordInput.value = '';
        submissionsContainer.innerHTML = '';
        allSubmissions = [];
    }

    async function loadSubmissions() {
        const token = localStorage.getItem('adminToken');

        try {
            const response = await fetch('/admin/api/submissions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    logout();
                    return;
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
        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`/admin/api/submissions/${submissionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`/admin/api/submissions/${submissionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                alert('Failed to delete submission');
                return;
            }

            loadSubmissions();
        } catch (error) {
            alert('Error deleting submission: ' + error.message);
            console.error('Error:', error);
        }
    };

    // Refresh submissions every 30 seconds
    setInterval(() => {
        const token = localStorage.getItem('adminToken');
        if (token && !adminPanel.classList.contains('hidden')) {
            loadSubmissions();
        }
    }, 30000);
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
