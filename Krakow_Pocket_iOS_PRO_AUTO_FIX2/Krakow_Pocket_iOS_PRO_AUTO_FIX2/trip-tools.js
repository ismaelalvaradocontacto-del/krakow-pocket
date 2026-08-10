(() => {
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./v34.css';
  document.head.appendChild(css);
  const core=document.createElement('script');
  core.src='./trip-tools-core.js';
  core.defer=true;
  document.head.appendChild(core);
  const v34=document.createElement('script');
  v34.src='./v34.js';
  v34.defer=true;
  document.head.appendChild(v34);
})();
