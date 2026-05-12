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
  const navUl = nav.querySelector('ul');
  const header = document.querySelector('header');

  // --- Hamburger Menu Logic ---
  hamburgerButton.addEventListener('click', () => {
    // Toggle the 'is-active' class on all elements
    hamburgerButton.classList.toggle('is-active');
    nav.classList.toggle('is-active');
    navUl.classList.toggle('is-active');
  });

  // Close mobile menu when a link is clicked
  const navItems = nav.querySelectorAll('a');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      hamburgerButton.classList.remove('is-active');
      nav.classList.remove('is-active');
      navUl.classList.remove('is-active');
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    const isClickInsideNav = nav.contains(e.target);
    const isClickOnHamburger = hamburgerButton.contains(e.target);
    
    if (!isClickInsideNav && !isClickOnHamburger && navUl.classList.contains('is-active')) {
      hamburgerButton.classList.remove('is-active');
      nav.classList.remove('is-active');
      navUl.classList.remove('is-active');
    }
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
