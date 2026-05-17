document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('galleryGrid');

    // Load gallery images from API
    async function loadGalleryImages() {
        try {
            const response = await fetch('/api/gallery');
            const images = await response.json();

            if (images.length === 0) {
                galleryGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: #999;">No photos available yet.</div>';
                return;
            }

            // Render images
            galleryGrid.innerHTML = images.map(img => `
                <div class="gallery-item">
                    <img src="images/${encodeURIComponent(img.filename)}" alt="${escapeHtml(img.display_name)}">
                </div>
            `).join('');

            // Re-attach modal functionality to new images
            attachGalleryListeners();
        } catch (error) {
            console.error('Error loading gallery:', error);
            galleryGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: #999;">Error loading gallery. Please try again later.</div>';
        }
    }

    // Function to create and show the modal
    const showModal = (src, alt) => {
        // Create modal elements
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';

        const modalContent = document.createElement('img');
        modalContent.className = 'modal-content';
        modalContent.src = src;
        modalContent.alt = alt;

        const modalClose = document.createElement('span');
        modalClose.className = 'modal-close';
        modalClose.innerHTML = '&times;';

        // Assemble the modal
        modalOverlay.appendChild(modalContent);
        modalOverlay.appendChild(modalClose);
        document.body.appendChild(modalOverlay);

        // Add 'active' class to trigger the fade-in animation
        setTimeout(() => modalOverlay.classList.add('active'), 10);

        // Function to close the modal
        const closeModal = () => {
            modalOverlay.classList.remove('active');
            // Remove the modal from the DOM after the transition ends
            modalOverlay.addEventListener('transitionend', () => modalOverlay.remove(), { once: true });
        };

        // Event listeners for closing the modal
        modalOverlay.addEventListener('click', closeModal);
        modalContent.addEventListener('click', (e) => e.stopPropagation()); // Prevent closing when clicking the image itself
    };

    // Attach listeners to gallery items
    function attachGalleryListeners() {
        const galleryItems = document.querySelectorAll('.gallery-item');
        galleryItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const img = item.querySelector('img');
                showModal(img.src, img.alt);
            });
        });
    }

    // Load images on page load
    loadGalleryImages();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
