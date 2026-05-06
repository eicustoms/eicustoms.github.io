document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('header .container nav ul li a');
  const currentPath = window.location.pathname.toLowerCase();
  const currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkFile = href.substring(href.lastIndexOf('/') + 1).toLowerCase();
    if (linkFile === currentFile || (linkFile === 'index.html' && currentFile === '')) {
      link.closest('li').classList.add('onpagemenuoption');
    }
  });

  const hamburgerButton = document.querySelector('.hamburger-menu');
  const nav = document.getElementById('main-nav');
  const header = document.querySelector('header');

    // --- Hamburger Menu Logic ---
    hamburgerButton.addEventListener('click', () => {
        // Toggle the 'is-active' class on both the button and the navigation
        hamburgerButton.classList.toggle('is-active');
        nav.classList.toggle('is-active');
    });

    // --- Header Scroll Effect ---
    // Function to add/remove the 'scrolled' class
    const handleHeaderScroll = () => {
        // Add 'scrolled' class if user has scrolled more than 10px, otherwise remove it
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    // Listen for the scroll event on the window
    window.addEventListener('scroll', handleHeaderScroll);
});