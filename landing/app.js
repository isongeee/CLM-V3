/**
 * Enterprise CLM Landing Page - Interactive Behaviors
 */
(() => {
  // DOM Elements
  const header = document.getElementById("site-header");
  const toast = document.querySelector(".toast");
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  // ==========================================
  // Toast Notification
  // ==========================================
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 2500);
  };

  // ==========================================
  // Mobile Navigation Toggle
  // ==========================================
  const setMobileNavOpen = (open) => {
    if (!navToggle || !mobileNav) return;
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    mobileNav.hidden = !open;
  };

  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      setMobileNavOpen(!isOpen);
    });

    mobileNav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) setMobileNavOpen(false);
    });
  }

  // ==========================================
  // Header Scroll Effect
  // ==========================================
  let lastScrollY = 0;
  const handleScroll = () => {
    const scrollY = window.scrollY;

    if (header) {
      if (scrollY > 50) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }

    lastScrollY = scrollY;
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll(); // Initial check

  // ==========================================
  // Scroll Reveal Animations (Intersection Observer)
  // ==========================================
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -100px 0px",
    threshold: 0.1,
  };

  const revealCallback = (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  };

  const revealObserver = new IntersectionObserver(revealCallback, observerOptions);

  // Elements to animate on scroll
  const animatedElements = document.querySelectorAll(
    ".feature-card, .step-card, .pricing-card, .section-head"
  );

  animatedElements.forEach((el) => {
    el.classList.add("reveal");
    revealObserver.observe(el);
  });

  // Add reveal animation styles dynamically
  const style = document.createElement("style");
  style.textContent = `
    .reveal {
      opacity: 0;
      transform: translateY(30px);
      transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), 
                  transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .feature-card.reveal { transition-delay: calc(var(--reveal-index, 0) * 0.1s); }
    .step-card.reveal { transition-delay: calc(var(--reveal-index, 0) * 0.15s); }
    .pricing-card.reveal { transition-delay: calc(var(--reveal-index, 0) * 0.1s); }
  `;
  document.head.appendChild(style);

  // Set stagger delay indexes
  document.querySelectorAll(".features-grid .feature-card").forEach((el, i) => {
    el.style.setProperty("--reveal-index", i);
  });
  document.querySelectorAll(".steps-grid .step-card").forEach((el, i) => {
    el.style.setProperty("--reveal-index", i);
  });
  document.querySelectorAll(".pricing-grid .pricing-card").forEach((el, i) => {
    el.style.setProperty("--reveal-index", i);
  });

  // ==========================================
  // Smooth Scroll for Anchor Links
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });

        // Close mobile nav if open
        setMobileNavOpen(false);
      }
    });
  });

  // ==========================================
  // Copy to Clipboard (for any data-copy buttons)
  // ==========================================
  document.addEventListener("click", async (e) => {
    const button = e.target.closest("[data-copy]");
    if (!button) return;

    const selector = button.getAttribute("data-copy");
    const el = selector ? document.querySelector(selector) : null;
    const text = el?.textContent ?? "";

    try {
      await navigator.clipboard.writeText(text.trim());
      showToast("Copied to clipboard");
    } catch {
      showToast("Copy failed (clipboard blocked)");
    }
  });

  // ==========================================
  // Parallax Effect for Hero (subtle)
  // ==========================================
  const heroVisual = document.querySelector(".hero-visual");

  if (heroVisual && window.matchMedia("(min-width: 1024px)").matches) {
    window.addEventListener("scroll", () => {
      const scrolled = window.scrollY;
      if (scrolled < 800) {
        heroVisual.style.transform = `translateY(${scrolled * 0.1}px)`;
      }
    }, { passive: true });
  }

  // ==========================================
  // Button Ripple Effect
  // ==========================================
  document.querySelectorAll(".button").forEach((button) => {
    button.addEventListener("click", function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;

      this.style.position = "relative";
      this.style.overflow = "hidden";
      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Add ripple keyframes
  const rippleStyle = document.createElement("style");
  rippleStyle.textContent = `
    @keyframes ripple {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(rippleStyle);

  // Log for development
  console.log("Enterprise CLM Landing Page loaded successfully.");
})();
