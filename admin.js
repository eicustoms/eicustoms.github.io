document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginContainer = document.getElementById('loginContainer');
    const adminPanel = document.getElementById('adminPanel');
    const submissionsContainer = document.getElementById('submissionsContainer');
    const loginError = document.getElementById('loginError');
    const passwordInput = document.getElementById('passwordInput');

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

            const submissions = await response.json();

            if (submissions.length === 0) {
                submissionsContainer.innerHTML = '<div class="no-submissions">No submissions yet.</div>';
            } else {
                submissionsContainer.innerHTML = submissions.map(submission => `
                    <div class="submission">
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
                    </div>
                `).join('');
            }
        } catch (error) {
            submissionsContainer.innerHTML = `<div class="no-submissions">Error loading submissions: ${error.message}</div>`;
            console.error('Load error:', error);
        }
    }

    // Expose logout globally
    window.logout = logout;

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
