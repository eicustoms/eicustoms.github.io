document.addEventListener('DOMContentLoaded', () => {
    const testimonialsGrid = document.getElementById('testimonialsGrid');

    async function loadComments() {
        try {
            const response = await fetch('/api/comments');
            if (!response.ok) {
                throw new Error('Failed to load testimonials');
            }

            const comments = await response.json();
            renderComments(comments);
        } catch (error) {
            console.error('Testimonials load error:', error);
            testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">Unable to load testimonials at this time.</div>';
        }
    }

    function renderComments(comments) {
        if (!comments || !comments.length) {
            testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">No testimonials available yet.</div>';
            return;
        }

        testimonialsGrid.innerHTML = comments.map(comment => `
            <div class="testimonial-item">
                <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" class="testimonial-photo">
                <blockquote>${escapeHtml(comment.content)}</blockquote>
                <p class="testimonial-author">- ${escapeHtml(comment.author)}</p>
                <span class="testimonial-service">${escapeHtml(comment.service || 'Client')}</span>
            </div>
        `).join('');
    }

    loadComments();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
