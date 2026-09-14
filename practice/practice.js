// The full guide and request remain available when this enhancement is unavailable.
const button = document.querySelector('[data-copy-request]');
const request = document.querySelector('#request-text');
const feedback = document.querySelector('[data-copy-feedback]');
if (button && request && feedback && navigator.clipboard?.writeText) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(request.textContent.trim());
      feedback.textContent = '요청문을 복사했습니다. 이미지에 맞게 바꿔 사용해 보세요.';
    } catch {
      feedback.textContent = '자동 복사를 사용할 수 없습니다. 위 요청문을 직접 선택해 복사해 주세요.';
      request.focus({ preventScroll: true });
    } finally {
      button.disabled = false;
    }
  });
}
