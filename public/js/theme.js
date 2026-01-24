// Theme management: light/dark with sun/moon toggle
(function () {
  const STORAGE_KEY = 'theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Apply saved theme on load (runs before DOMReady is ok for body class)
  applyTheme(getTheme());

  // Expose for button onclick
  window.toggleTheme = toggleTheme;
})();
