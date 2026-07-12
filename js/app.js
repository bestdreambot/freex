// js/app.js - FreeX v7.0 Main Entry Point
console.log('%c[FreeX v7.0] Modular version loaded', 'color:#10a37f');

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="padding: 40px 20px; max-width: 600px; margin: 0 auto; text-align: center; color: #eee;">
        <h1 style="color: #10a37f; margin-bottom: 10px;">FreeX v7.0</h1>
        <p style="font-size: 18px; color: #aaa;">Модульная структура активирована.</p>
        <p style="color: #666; margin-top: 20px;">Рефакторинг в процессе. Полная версия скоро будет готова.</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 12px 28px; background: #10a37f; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
          Перезагрузить
        </button>
      </div>
    `;
  }
});