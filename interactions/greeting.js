// Visitor-local time only. No location lookup, analytics or broadcast-status claim.
export function greetingForHour(hour) {
  if (hour >= 5 && hour < 11) return '좋은 아침이에요. 오늘도 나의 속도로.';
  if (hour >= 11 && hour < 17) return '분주한 하루에, 잠깐의 여유를.';
  if (hour >= 17 && hour < 22) return '하루의 끝에, 나를 위한 시간을.';
  return '고요한 시간, 편안히 머물다 가세요.';
}
export function initGreeting() {
  const target = document.querySelector('[data-time-greeting]');
  if (!target) return () => {};
  const update = () => {
    if (!document.hidden) target.textContent = greetingForHour(new Date().getHours());
  };
  update();
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pageshow', update);
  return () => {
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pageshow', update);
  };
}
