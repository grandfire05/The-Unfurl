/* 성능 표시 (우측 상단). 브라우저는 페이지에 CPU·GPU 사용률을 직접 알려주지 않아서,
   화면에서 잴 수 있는 값(FPS·프레임 시간·메인 스레드 부하·JS 메모리)으로 보여 준다.
   배지를 누르면 접히고, 설정은 기억한다. */
(function () {
  'use strict';
  const el = document.createElement('div');
  el.id = 'perf';
  document.body.appendChild(el);
  let hidden = false;
  try { hidden = localStorage.getItem('guild_perf') === '0'; } catch (e) { /* 무시 */ }
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const x = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (x) gpu = String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL) || '').replace(/ANGLE \(|\)$/g, '').split(',')[1] || '';
  } catch (e) { /* 무시 */ }
  el.title = '클릭하면 접고 펼쳐요\n브라우저는 CPU·GPU 사용률을 직접 알려주지 않아요.\n부하 = 한 번에 50ms 넘게 걸린 작업이 차지한 비율(메인 스레드)\n' + (gpu ? 'GPU: ' + gpu.trim() : '');
  let frames = 0, last = performance.now(), busy = 0, worst = 0, prev = last;
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { busy += e.duration; })).observe({ entryTypes: ['longtask'] });
  } catch (e) { /* 지원 안 함 */ }
  const tick = (t) => {
    frames++; worst = Math.max(worst, t - prev); prev = t;
    if (t - last >= 1000) {
      const dt = t - last, fps = Math.round((frames * 1000) / dt), load = Math.min(100, Math.round((busy / dt) * 100));
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : '–';
      el.innerHTML = hidden ? 'FPS ' + fps : `<b class="${fps < 30 ? 'bad' : fps < 50 ? 'mid' : ''}">FPS ${fps}</b><span>최대 ${Math.round(worst)}ms</span><span class="${load > 30 ? 'bad' : ''}">부하 ${load}%</span><span>메모리 ${mem}</span>`;
      frames = 0; busy = 0; worst = 0; last = t;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  el.addEventListener('click', () => { hidden = !hidden; try { localStorage.setItem('guild_perf', hidden ? '0' : '1'); } catch (e) { /* 무시 */ } });
})();
