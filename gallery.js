document.addEventListener('DOMContentLoaded', () => {
    const galleryItems = document.querySelectorAll('.gallery-item');

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

    // Add a click listener to each gallery item
    galleryItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default link behavior
            const img = item.querySelector('img');
            showModal(img.src, img.alt);
        });
    });
});