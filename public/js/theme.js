// Theme management: light/dark with sun/moon toggle
(function () {
  const STORAGE_KEY = 'theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    // Also toggle Tailwind's 'dark' class on <html> so dark: variants work
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    // Notify other components (like canvas) to redraw
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
  }

  // Apply saved theme on load (runs before DOMReady is ok for body class)
  applyTheme(getTheme());

  // Expose for button onclick
  window.toggleTheme = toggleTheme;
})();
