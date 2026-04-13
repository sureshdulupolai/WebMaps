(function() {
  var theme = localStorage.getItem('wm-theme');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
