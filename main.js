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
  const navUl = nav ? nav.querySelector('ul') : null;
  const header = document.querySelector('header');

  if (!hamburgerButton || !nav || !navUl) {
    console.error('Menu elements not found');
    return;
  }

  // --- Hamburger Menu Logic ---
  hamburgerButton.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburgerButton.classList.toggle('is-active');
    navUl.classList.toggle('is-active');
    hamburgerButton.setAttribute('aria-expanded', navUl.classList.contains('is-active'));
  });

  // Close mobile menu when a link is clicked
  const navItems = navUl.querySelectorAll('a');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      hamburgerButton.classList.remove('is-active');
      navUl.classList.remove('is-active');
      hamburgerButton.setAttribute('aria-expanded', 'false');
    });
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    const isClickInsideNav = nav.contains(e.target);
    const isClickOnHamburger = hamburgerButton.contains(e.target);
    
    if (!isClickInsideNav && !isClickOnHamburger && navUl.classList.contains('is-active')) {
      hamburgerButton.classList.remove('is-active');
      navUl.classList.remove('is-active');
      hamburgerButton.setAttribute('aria-expanded', 'false');
    }
  });

  // --- Header Scroll Effect ---
  const handleHeaderScroll = () => {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleHeaderScroll);
});
