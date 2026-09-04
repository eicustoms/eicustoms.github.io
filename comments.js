document.addEventListener('DOMContentLoaded', () => {
  const testimonialsGrid = document.getElementById('testimonialsGrid');

  // Small toggle stays for testing but default behavior is preserved visually.
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

    // Keep original card markup exactly as before, but wrap them in a horizontal container when manual mode is enabled.
    const cardHtml = comments.map(comment => `
      <div class="testimonial-item" data-index="${escapeHtml(comment.id || '')}" style="box-sizing:border-box;">
          <img src="${escapeHtml(comment.image || 'images/logo.png')}" alt="${escapeHtml(comment.author)}" class="testimonial-photo">
          <blockquote>${escapeHtml(comment.content)}</blockquote>
          <p class="testimonial-author">- ${escapeHtml(comment.author)}</p>
          <span class="testimonial-service">${escapeHtml(comment.service || 'Client')}</span>
      </div>
    `).join('');

    if (!manualMode()) {
      // original static rendering (no layout change to cards)
      testimonialsGrid.innerHTML = cardHtml;
      return;
    }

    // Manual mode: keep the same card HTML but place them inside a horizontally scrollable wrapper
    const wrapperId = 'manualTestimonialsWrapper';
    const dotsId = 'manualTestimonialsDots';

    testimonialsGrid.innerHTML = `
      <div id="${wrapperId}" style="display:flex; gap:12px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; padding-bottom:8px;">
        ${cardHtml}
      </div>
      <div id="${dotsId}" style="display:flex; justify-content:center; gap:8px; margin-top:8px;">
      </div>
    `;

    const wrapper = document.getElementById(wrapperId);
    const slides = Array.from(wrapper.children); // these are the same .testimonial-item elements
    const dotsContainer = document.getElementById(dotsId);

    // Make sure each slide has scroll-snap-align and consistent sizing without altering internal markup
    slides.forEach(s => {
      s.style.flex = '0 0 auto';
      s.style.scrollSnapAlign = 'center';
      // give a sensible min width so cards remain readable
      s.style.minWidth = '280px';
      s.style.maxWidth = '90%';
    });

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
      dot.style.transition = 'background 150ms ease';

      dot.addEventListener('click', () => {
        // center the corresponding slide
        const target = slides[idx];
        if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      });

      dotsContainer.appendChild(dot);
    });

    // update active dot based on closest slide to center
    function updateActiveDot() {
      const containerRect = wrapper.getBoundingClientRect();
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

      const dots = Array.from(dotsContainer.children);
      dots.forEach((d, i) => d.style.background = i === closestIndex ? '#333' : '#ddd');
    }

    // Drag-to-scroll behavior using pointer events
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    wrapper.style.cursor = 'grab';

    wrapper.addEventListener('pointerdown', (e) => {
      isDown = true;
      wrapper.setPointerCapture(e.pointerId);
      startX = e.clientX;
      scrollLeft = wrapper.scrollLeft;
      wrapper.style.cursor = 'grabbing';
    });

    wrapper.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const walk = startX - e.clientX;
      wrapper.scrollLeft = scrollLeft + walk;
    });

    wrapper.addEventListener('pointerup', (e) => {
      isDown = false;
      try { wrapper.releasePointerCapture(e.pointerId); } catch (err) {}
      wrapper.style.cursor = 'grab';
      snapToNearest();
    });

    wrapper.addEventListener('pointerleave', () => {
      if (isDown) {
        isDown = false;
        wrapper.style.cursor = 'grab';
        snapToNearest();
      }
    });

    function snapToNearest() {
      const containerRect = wrapper.getBoundingClientRect();
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
      if (closest) closest.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }

    // update active dot on scroll (throttled)
    let scrollTimer = null;
    wrapper.addEventListener('scroll', () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        updateActiveDot();
      }, 80);
    });

    // initial highlight
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
