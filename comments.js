document.addEventListener('DOMContentLoaded', () => {
  const testimonialsGrid = document.getElementById('testimonialsGrid');
  const prevBtn = document.getElementById('testPrev');
  const nextBtn = document.getElementById('testNext');
  const playPauseBtn = document.getElementById('testPlayPause');

  let comments = [];
  let current = 0;
  let interval = null;
  const AUTO_MS = 5000;

  async function loadComments() {
    try {
      const response = await fetch('/api/comments');
      if (!response.ok) throw new Error('Failed to load testimonials');
      comments = await response.json();
      renderComments(comments);
      startAuto();
    } catch (error) {
      console.error('Testimonials load error:', error);
      testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">Unable to load testimonials at this time.</div>';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderComments(list) {
    if (!list || !list.length) {
      testimonialsGrid.innerHTML = '<div class="no-testimonials" style="grid-column: 1/-1; padding: 40px; text-align:center; color:#999;">No testimonials available yet.</div>';
      return;
    }
    // create slides
    testimonialsGrid.innerHTML = list.map((comment, i) => `
      <div class="testimonial-item" data-index="${i}" style="${i === 0 ? '' : 'display:none;'}">
        <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" class="testimonial-photo">
        <blockquote>${escapeHtml(comment.content)}</blockquote>
        <p class="testimonial-author">- ${escapeHtml(comment.author)}</p>
        <span class="testimonial-service">${escapeHtml(comment.service || 'Client')}</span>
      </div>
    `).join('');
    current = 0;
    showIndex(current);
  }

  function showIndex(index) {
    const slides = testimonialsGrid.querySelectorAll('.testimonial-item');
    if (!slides.length) return;
    slides.forEach((s, i) => s.style.display = i === index ? '' : 'none');
  }

  function next() {
    if (!comments.length) return;
    current = (current + 1) % comments.length;
    showIndex(current);
  }
  function prev() {
    if (!comments.length) return;
    current = (current - 1 + comments.length) % comments.length;
    showIndex(current);
  }

  function startAuto() {
    stopAuto();
    interval = setInterval(next, AUTO_MS);
    updatePlayPause(true);
  }
  function stopAuto() {
    if (interval) clearInterval(interval);
    interval = null;
    updatePlayPause(false);
  }
  function updatePlayPause(isPlaying) {
    if (!playPauseBtn) return;
    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    playPauseBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); stopAuto(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); stopAuto(); });
  if (playPauseBtn) playPauseBtn.addEventListener('click', () => {
    if (interval) stopAuto(); else startAuto();
  });

  loadComments();
});
