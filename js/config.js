// config.js - конфигурация для разных окружений
const API_URL = (() => {
    // На Vercel (продакшн)
    if (window.location.hostname === 'paramguard.vercel.app') {
        // Ваш ngrok URL (замените на свой)
        return 'https://probanishment-nonmeteorologically-dewitt.ngrok-free.dev';
    }
    // На локальном сервере
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    // Локальная разработка (по умолчанию)
    return 'http://localhost:3000';
})();

// Демо-режим (теперь отключён, так как есть бэкенд)
const DEMO_MODE = false;

// Делаем переменные глобальными (доступными в других скриптах)
window.API_URL = API_URL;
window.DEMO_MODE = DEMO_MODE;

// Выводим в консоль для отладки
console.log('🔧 Конфигурация загружена:');
console.log('   API_URL:', API_URL);
console.log('   DEMO_MODE:', DEMO_MODE);
console.log('   Хост:', window.location.hostname);