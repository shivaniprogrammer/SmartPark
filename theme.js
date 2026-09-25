(function(){
  const theme = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light-theme', theme === 'light');
})();