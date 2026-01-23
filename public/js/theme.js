// Theme management logic
(function () {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(`theme-${savedTheme}`);
    console.log('[Theme] System initialized');
})();
