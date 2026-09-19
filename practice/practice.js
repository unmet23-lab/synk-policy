const version = new URL(import.meta.url).search;
import('./copy-request.js' + version).then(module => module.initRequestEditors());
import('./blink-demo.js' + version).then(module => module.initBlinkDemo()).catch(() => {
  const status = document.querySelector('[data-blink-status]');
  if (status) status.textContent = '움직임을 불러오지 못해 원본을 보여드립니다.';
});
