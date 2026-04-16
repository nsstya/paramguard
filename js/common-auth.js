// js/common-auth.js - Общая авторизация для всех страниц

const API_URL = 'http://localhost:3000/api';

// ----- ОТКРЫТИЕ/ЗАКРЫТИЕ ОКОН -----
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    
    if (loginModal) loginModal.style.display = 'flex';
    if (registerModal) registerModal.style.display = 'none';
    if (profileModal) profileModal.style.display = 'none';
}

function openRegisterModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'flex';
    if (profileModal) profileModal.style.display = 'none';
}

function openProfileModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    if (profileModal) profileModal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function switchToRegister() {
    closeModal('loginModal');
    openRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    openLoginModal();
}

// ----- УВЕДОМЛЕНИЯ -----
function showNotification(message, type = 'success') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }
    notification.innerHTML = `<span>${message}</span>`;
    notification.style.display = 'flex';
    notification.className = `notification ${type}`;
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// ----- ВХОД -----
async function handleLogin() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            closeModal('loginModal');
            showNotification(`Добро пожаловать, ${data.user.full_name}!`);
            updateUserIcon();
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification(data.error || 'Неверный email или пароль', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// ----- РЕГИСТРАЦИЯ -----
async function handleRegister() {
    const fullName = document.getElementById('regFullName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const phone = document.getElementById('regPhone')?.value;
    const password = document.getElementById('regPassword')?.value;
    const passwordConfirm = document.getElementById('regPasswordConfirm')?.value;
    const consent = document.getElementById('regConsent')?.checked;
    
    if (!fullName || !email || !password) {
        showNotification('Заполните обязательные поля', 'error');
        return;
    }
    
    if (password !== passwordConfirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    if (!consent) {
        showNotification('Необходимо согласие на обработку данных', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                phone,
                pd_consent: true
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            closeModal('registerModal');
            showNotification('Регистрация успешна!');
            updateUserIcon();
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// ----- ВЫХОД -----
function logout() {
    localStorage.removeItem('user');
    updateUserIcon();
    showNotification('Вы вышли из системы', 'info');
    setTimeout(() => window.location.reload(), 1000);
}

// ----- ОБНОВЛЕНИЕ ИКОНКИ -----
function updateUserIcon() {
    const savedUser = localStorage.getItem('user');
    const userIcon = document.querySelector('.user-icon');
    
    if (savedUser && userIcon) {
        const user = JSON.parse(savedUser);
        const initial = user.full_name.charAt(0).toUpperCase();
        userIcon.innerHTML = `<span>${initial}</span>`;
    } else if (userIcon) {
        userIcon.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// ----- ЗАГРУЗКА КОМПОНЕНТОВ -----
function loadComponents() {
    // Загружаем шапку
    fetch('/components/header.html')
        .then(r => r.text())
        .then(html => {
            const header = document.getElementById('header');
            if (header) {
                header.innerHTML = html;
                console.log('✅ Шапка загружена');
                updateUserIcon();
                
                // Настраиваем иконку после загрузки
                setTimeout(() => {
                    const userIcon = document.querySelector('.user-icon');
                    if (userIcon) {
                        userIcon.onclick = function() {
                            if (localStorage.getItem('user')) {
                                openProfileModal();
                            } else {
                                openLoginModal();
                            }
                        };
                    }
                }, 100);
            }
        })
        .catch(e => console.error('❌ Ошибка загрузки шапки:', e));
    
    // Загружаем подвал
    fetch('/components/footer.html')
        .then(r => r.text())
        .then(html => {
            const footer = document.getElementById('footer');
            if (footer) {
                footer.innerHTML = html;
                console.log('✅ Подвал загружен');
            }
        })
        .catch(e => console.error('❌ Ошибка загрузки подвала:', e));
    
    // Загружаем окно входа
    fetch('/components/login-modal.html')
        .then(r => r.text())
        .then(html => {
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.innerHTML = html;
                console.log('✅ Окно входа загружено');
            }
        })
        .catch(e => console.error('❌ Ошибка загрузки окна входа:', e));
    
    // Загружаем окно регистрации
    fetch('/components/register-modal.html')
        .then(r => r.text())
        .then(html => {
            const registerModal = document.getElementById('registerModal');
            if (registerModal) {
                registerModal.innerHTML = html;
                console.log('✅ Окно регистрации загружено');
            }
        })
        .catch(e => console.error('❌ Ошибка загрузки окна регистрации:', e));
}

// ----- ИНИЦИАЛИЗАЦИЯ -----
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 common-auth.js инициализирован');
    
    // Закрываем все окна
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    if (profileModal) profileModal.style.display = 'none';
    
    // Загружаем компоненты
    loadComponents();
});

// Глобальные функции
window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.openProfileModal = openProfileModal;
window.closeModal = closeModal;
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.showNotification = showNotification;