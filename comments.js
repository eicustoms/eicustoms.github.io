document.addEventListener('DOMContentLoaded', () => {
  const testimonialsGrid = document.getElementById('testimonialsGrid');

  // Toggle to switch to manual slider mode for testing.
  // State is saved in localStorage under 'manualCommentsSlider'.
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

    // Manual slider mode (all items visible in a horizontally scrollable strip)
    // Render items into a container that supports horizontal drag + dots navigation.
    const containerId = 'manualTestimonialsContainer';
    const controlsId = 'manualTestimonialsDots';

    const itemsHtml = comments.map((comment, i) => `
      <div class="testimonial-slide" data-index="${i}" style="min-width:280px; max-width:90%; box-sizing:border-box; padding:12px; scroll-snap-align:center; flex: 0 0 auto;">
        <div style="background:#fff; border:1px solid #eee; border-radius:8px; padding:16px; height:100%; box-shadow:0 1px 2px rgba(0,0,0,0.03)">
          <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;float:left;margin-right:12px;">
          <div style="overflow:hidden;">
            <blockquote style="margin:0 0 8px 0;">${escapeHtml(comment.content)}</blockquote>
            <p style="margin:0;font-weight:600;">${escapeHtml(comment.author)}</p>
            <div style="font-size:12px;color:#666;margin-top:4px;">${escapeHtml(comment.service || 'Client')}</div>
          </div>
          <div style="clear:both"></div>
        </div>
      </div>
    `).join('');

    const wrapperHtml = `
      <div id="${containerId}" style="display:flex; gap:12px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; padding-bottom:8px;">
        ${itemsHtml}
      </div>
      <div id="${controlsId}" style="display:flex; justify-content:center; gap:8px; margin-top:8px;">
      </div>
    `;

    testimonialsGrid.innerHTML = wrapperHtml;

    const container = document.getElementById(containerId);
    const dotsContainer = document.getElementById(controlsId);
    const slides = Array.from(container.querySelectorAll('.testimonial-slide'));

    // create dots
    dotsContainer.innerHTML = '';
    slides.forEach((s, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'testimonial-dot';
      dot.setAttribute('aria-label', `Go to testimonial ${idx + 1}`);
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.border = 'none';
      dot.style.background = idx === 0 ? '#333' : '#ddd';
      dot.style.padding = '0';
      dot.style.cursor = 'pointer';

      dot.addEventListener('click', () => {
        // smooth scroll the slide into center view
        s.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });

      dotsContainer.appendChild(dot);
    });

    // update active dot based on closest slide to center
    function updateActiveDot() {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;
      slides.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const slideCenter = r.left + r.width / 2;
        const d = Math.abs(containerCenter - slideCenter);
        if (d < closestDistance) {
          closestDistance = d;
          closestIndex = i;
        }
      });

      // highlight dot
      const dots = Array.from(dotsContainer.children);
      dots.forEach((d, i) => d.style.background = i === closestIndex ? '#333' : '#ddd');
    }

    // Drag-to-scroll (pointer events)
    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('pointerdown', (e) => {
      isDown = true;
      container.setPointerCapture(e.pointerId);
      startX = e.clientX;
      scrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
    });

    container.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const walk = startX - e.clientX; // positive when moving left
      container.scrollLeft = scrollLeft + walk;
    });

    container.addEventListener('pointerup', (e) => {
      isDown = false;
      try { container.releasePointerCapture(e.pointerId); } catch (err) {}
      container.style.cursor = 'grab';
      // snap to nearest
      snapToNearest();
    });
    container.addEventListener('pointerleave', () => {
      if (isDown) {
        isDown = false;
        container.style.cursor = 'grab';
        snapToNearest();
      }
    });

    // mouse wheel should scroll horizontally on Shift or trackpad naturally; no extra

    // Snap to nearest slide after user interaction
    function snapToNearest() {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      let closest = slides[0];
      let closestDistance = Infinity;
      slides.forEach((s) => {
        const r = s.getBoundingClientRect();
        const slideCenter = r.left + r.width / 2;
        const d = Math.abs(containerCenter - slideCenter);
        if (d < closestDistance) {
          closestDistance = d;
          closest = s;
        }
      });
      closest.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Update active dot on scroll (throttle)
    let scrollTimer = null;
    container.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        updateActiveDot();
      }, 80);
    });

    // initial set
    container.style.cursor = 'grab';
    updateActiveDot();
  }

  loadComments();
});

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
