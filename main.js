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
    }});

  // --- Hidden Admin Link (Triple-click logo) ---
  const logoLink = document.querySelector('header .logo');
  let clickCount = 0;
  let clickTimeout;
  let navTimer;

  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      clickCount++;
      clearTimeout(clickTimeout);
      clearTimeout(navTimer);

      if (clickCount === 3) {
        const footer = document.querySelector('footer .container');
        if (footer && !footer.querySelector('a.admin-hidden-link')) {
          const adminLink = document.createElement('a');
          adminLink.href = 'admin.html';
          adminLink.textContent = 'Admin';
          adminLink.className = 'admin-hidden-link';
          adminLink.style.cssText = `
            color: #F9A03F;
            text-decoration: none;
            font-size: 0.9rem;
            margin-left: 1rem;
            transition: color 0.2s ease;
          `;
          adminLink.addEventListener('mouseenter', () => adminLink.style.color = '#E88E2B');
          adminLink.addEventListener('mouseleave', () => adminLink.style.color = '#F9A03F');
          footer.appendChild(adminLink);

          // Auto-remove after 30 seconds
          setTimeout(() => {
            if (adminLink.parentNode) {
              adminLink.remove();
            }
          }, 30000);
        }

        clickCount = 0;
        return;
      }

      navTimer = setTimeout(() => {
        if (clickCount > 0 && clickCount < 3) {
          window.location.href = logoLink.getAttribute('href');
        }
      }, 250);

      clickTimeout = setTimeout(() => {
        clickCount = 0;
      }, 1000); // Reset after 1 second

      if (clickCount === 2) {
        logoLink.classList.add('admin-hint');
        setTimeout(() => {
          logoLink.classList.remove('admin-hint');
        }, 600);
      }
    });
  }

  const hamburgerButton = document.querySelector('.hamburger-menu');
  const nav = document.getElementById('main-nav');
  const header = document.querySelector('header');

    // --- Hamburger Menu Logic ---
    if (hamburgerButton && nav) {
        let overlay = document.querySelector('.mobile-nav-backdrop');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-nav-backdrop';
            document.body.appendChild(overlay);
        }

        const closeMobileNav = () => {
            if (!nav.classList.contains('is-active')) return;
            nav.classList.remove('is-active');
            hamburgerButton.classList.remove('is-active');
            hamburgerButton.setAttribute('aria-expanded', 'false');
            overlay.classList.remove('is-active');
        };

        hamburgerButton.addEventListener('click', () => {
            const isActive = hamburgerButton.classList.toggle('is-active');
            nav.classList.toggle('is-active');
            overlay.classList.toggle('is-active', isActive);
            hamburgerButton.setAttribute('aria-expanded', String(isActive));
        });

        overlay.addEventListener('click', closeMobileNav);

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMobileNav);
            link.addEventListener('touchstart', () => link.classList.add('mobile-touch-active'));
            link.addEventListener('touchend', () => link.classList.remove('mobile-touch-active'));
            link.addEventListener('touchcancel', () => link.classList.remove('mobile-touch-active'));
        });

        // Close the mobile nav if the user taps outside the nav or hamburger button
        document.addEventListener('click', (event) => {
            if (!nav.classList.contains('is-active')) return;
            const clickedInsideNav = event.target.closest('#main-nav');
            const clickedHamburger = event.target.closest('.hamburger-menu');
            const clickedBackdrop = event.target.closest('.mobile-nav-backdrop');
            if (!clickedInsideNav && !clickedHamburger && !clickedBackdrop) {
                closeMobileNav();
            }
        });
    }

    // --- Header Scroll Effect ---
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