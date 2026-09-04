document.addEventListener('DOMContentLoaded', () => {
    const testimonialsGrid = document.getElementById('testimonialsGrid');

    // Add a small toggle so you can switch to the manual slider mode for testing.
    // The toggle state is saved in localStorage under 'manualCommentsSlider'.
    const controlsWrapper = document.createElement('div');
    controlsWrapper.style.display = 'flex';
    controlsWrapper.style.alignItems = 'center';
    controlsWrapper.style.gap = '8px';
    controlsWrapper.style.marginBottom = '12px';

    const toggleLabel = document.createElement('label');
    toggleLabel.style.fontSize = '13px';
    toggleLabel.style.color = '#333';

    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'manualCommentsSliderToggle';
    toggleCheckbox.style.marginRight = '6px';

    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(document.createTextNode('Enable manual testimonials slider'));

    controlsWrapper.appendChild(toggleLabel);

    // Insert the toggle before the testimonials grid if possible
    if (testimonialsGrid && testimonialsGrid.parentNode) {
        testimonialsGrid.parentNode.insertBefore(controlsWrapper, testimonialsGrid);
    }

    const manualMode = () => localStorage.getItem('manualCommentsSlider') === 'true';
    const setManualMode = (v) => {
        localStorage.setItem('manualCommentsSlider', v ? 'true' : 'false');
        toggleCheckbox.checked = v;
    };

    // initialize toggle state
    toggleCheckbox.checked = manualMode();
    toggleCheckbox.addEventListener('change', () => {
        setManualMode(toggleCheckbox.checked);
        // re-load comments to switch modes immediately
        loadComments();
    });

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
            if (testimonialsGrid) testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">Unable to load testimonials at this time.</div>';
        }
    }

    function renderComments(comments) {
        if (!testimonialsGrid) return;

        if (!comments || !comments.length) {
            testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">No testimonials available yet.</div>';
            return;
        }

        if (!manualMode()) {
            // original behavior: render all testimonials statically
            testimonialsGrid.innerHTML = comments.map(comment => `
                <div class="testimonial-item">
                    <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" class="testimonial-photo">
                    <blockquote>${escapeHtml(comment.content)}</blockquote>
                    <p class="testimonial-author">- ${escapeHtml(comment.author)}</p>
                    <span class="testimonial-service">${escapeHtml(comment.service || 'Client')}</span>
                </div>
            `).join('');
            return;
        }

        // Manual slider mode: render slides and inject controls
        testimonialsGrid.innerHTML = comments.map((comment, i) => `
            <div class="testimonial-item" data-index="${i}" style="${i === 0 ? '' : 'display:none;'}">
                <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" class="testimonial-photo">
                <blockquote>${escapeHtml(comment.content)}</blockquote>
                <p class="testimonial-author">- ${escapeHtml(comment.author)}</p>
                <span class="testimonial-service">${escapeHtml(comment.service || 'Client')}</span>
            </div>
        `).join('');

        // Create or reuse control bar
        let ctrl = document.getElementById('testimonialManualControls');
        if (!ctrl) {
            ctrl = document.createElement('div');
            ctrl.id = 'testimonialManualControls';
            ctrl.style.display = 'flex';
            ctrl.style.gap = '10px';
            ctrl.style.justifyContent = 'center';
            ctrl.style.marginTop = '12px';
            testimonialsGrid.parentNode.insertBefore(ctrl, testimonialsGrid.nextSibling);
        } else {
            ctrl.innerHTML = '';
        }

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = '◀';
        prevBtn.style.padding = '6px 10px';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.type = 'button';
        playPauseBtn.textContent = '⏸';
        playPauseBtn.style.padding = '6px 10px';

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = '▶';
        nextBtn.style.padding = '6px 10px';

        ctrl.appendChild(prevBtn);
        ctrl.appendChild(playPauseBtn);
        ctrl.appendChild(nextBtn);

        let current = 0;
        let interval = null;
        const AUTO_MS = 5000;

        function showIndex(index) {
            const slides = testimonialsGrid.querySelectorAll('.testimonial-item');
            if (!slides.length) return;
            slides.forEach((s, i) => s.style.display = i === index ? '' : 'none');
        }

        function next() {
            const slides = testimonialsGrid.querySelectorAll('.testimonial-item');
            if (!slides.length) return;
            current = (current + 1) % slides.length;
            showIndex(current);
        }

        function prev() {
            const slides = testimonialsGrid.querySelectorAll('.testimonial-item');
            if (!slides.length) return;
            current = (current - 1 + slides.length) % slides.length;
            showIndex(current);
        }

        function startAuto() {
            stopAuto();
            interval = setInterval(next, AUTO_MS);
            playPauseBtn.textContent = '⏸';
        }

        function stopAuto() {
            if (interval) clearInterval(interval);
            interval = null;
            playPauseBtn.textContent = '▶';
        }

        prevBtn.addEventListener('click', () => { prev(); stopAuto(); });
        nextBtn.addEventListener('click', () => { next(); stopAuto(); });
        playPauseBtn.addEventListener('click', () => { if (interval) stopAuto(); else startAuto(); });

        // start autoplay by default in manual mode
        startAuto();
    }

    loadComments();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
