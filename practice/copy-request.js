// Copy the visitor's current edits; never submit or persist their text.
export function initRequestEditors(root = document, clipboard = navigator.clipboard) {
  root.querySelectorAll('[data-request-editor]').forEach(editor => {
    const button = editor.querySelector('[data-copy-request]');
    const request = editor.querySelector('[data-request-text]');
    const feedback = editor.querySelector('[data-copy-feedback]');
    if (!button || !request || !feedback || !clipboard?.writeText) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const text = request.value.trim();
      if (!text) {
        feedback.textContent = '복사할 요청문을 먼저 입력해 주세요.';
        request.focus({preventScroll: true});
        return;
      }
      button.disabled = true;
      try {
        await clipboard.writeText(text);
        feedback.textContent = '복사했습니다. 사용할 AI에 원본 이미지와 함께 보내세요.';
      } catch {
        feedback.textContent = '자동 복사가 되지 않았습니다. 선택된 요청문을 직접 복사해 주세요.';
        request.focus({preventScroll: true});
        request.select();
      } finally {
        button.disabled = false;
      }
    });
  });
}
