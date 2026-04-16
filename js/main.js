// main.js - Полная версия с авторизацией

// Глобальные переменные
const App = {
    currentUser: null,
    network: 'testnet',
    notifications: [],
    insuranceTypes: {
        travel: { active: true, price: 15 },
        auto: { active: false, price: 25 },
        property: { active: false, price: 30 },
        agro: { active: false, price: 20 }
    },
    apiUrl: 'http://localhost:3000/api'
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    await checkAuthStatus();
    initializeEventListeners();
    showNotification('Добро пожаловать в ParamGuard!', 'success');
});

// Загрузка компонентов
async function loadComponents() {
    try {
        // Загружаем шапку
        const headerResponse = await fetch('/components/header.html');
        const headerHtml = await headerResponse.text();
        document.getElementById('header').innerHTML = headerHtml;
        
        // Загружаем подвал
        const footerResponse = await fetch('/components/footer.html');
        const footerHtml = await footerResponse.text();
        document.getElementById('footer').innerHTML = footerHtml;
        
        // Загружаем модальные окна авторизации
        const authModalsResponse = await fetch('/components/auth-modals.html');
        if (authModalsResponse.ok) {
            const authModalsHtml = await authModalsResponse.text();
            const loginModalContainer = document.getElementById('loginModal');
            const registerModalContainer = document.getElementById('registerModal');
            const profileModalContainer = document.getElementById('profileModal');
            
            if (loginModalContainer && registerModalContainer && profileModalContainer) {
                // Разделяем HTML на три модальных окна (можно упростить - загрузить в один контейнер)
                loginModalContainer.innerHTML = authModalsHtml;
                registerModalContainer.innerHTML = authModalsHtml;
                profileModalContainer.innerHTML = authModalsHtml;
            }
        }
        
        // Активируем текущий пункт меню
        highlightCurrentMenuItem();
    } catch (error) {
        console.error('Ошибка загрузки компонентов:', error);
    }
}

// Подсветка текущего пункта меню
function highlightCurrentMenuItem() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const menuLinks = document.querySelectorAll('.nav-menu a');
    
    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || 
            (currentPage === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// Проверка статуса авторизации
async function checkAuthStatus() {
    const user = Storage.get('user');
    if (user && user.id) {
        // Проверяем, существует ли пользователь в БД
        const isValid = await validateUserSession(user.id);
        if (isValid) {
            App.currentUser = user;
            updateUIForAuth();
        } else {
            // Сессия невалидна, выходим
            logout();
        }
    }
}

// Валидация сессии пользователя
async function validateUserSession(userId) {
    try {
        const response = await fetch(`${App.apiUrl}/users/${userId}`);
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Ошибка валидации сессии:', error);
        return false;
    }
}

// Обновление UI для авторизованного пользователя
function updateUIForAuth() {
    const userIcon = document.querySelector('.user-icon');
    const userMenu = document.querySelector('.user-menu');
    const loginBtn = document.querySelector('#loginBtn');
    const registerBtn = document.querySelector('#registerBtn');
    const logoutBtn = document.querySelector('#logoutBtn');
    
    if (App.currentUser) {
        // Пользователь авторизован
        if (userIcon) {
            userIcon.innerHTML = `<span>${App.currentUser.full_name ? App.currentUser.full_name.charAt(0).toUpperCase() : 'U'}</span>`;
            userIcon.title = App.currentUser.full_name || App.currentUser.email;
        }
        
        if (userMenu) userMenu.style.display = 'block';
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
        // Пользователь не авторизован
        if (userIcon) {
            userIcon.innerHTML = '<i class="fas fa-user"></i>';
            userIcon.title = 'Войти';
        }
        
        if (userMenu) userMenu.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'block';
        if (registerBtn) registerBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// Показ уведомлений
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${icons[type] || icons.success}"></i>
        <span>${message}</span>
    `;
    notification.style.display = 'flex';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Инициализация обработчиков событий
function initializeEventListeners() {
    // Закрытие уведомлений по клику
    document.addEventListener('click', (e) => {
        if (e.target.closest('.notification')) {
            e.target.closest('.notification').style.display = 'none';
        }
    });
    
    // Закрытие модальных окон по клику вне их
    window.onclick = function(event) {
        if (event.target.classList && event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// =====================================================
// ФУНКЦИИ АВТОРИЗАЦИИ
// =====================================================

// Регистрация
async function registerUser(email, password, fullName, phone, passportData, consent) {
    if (!consent) {
        showNotification('Необходимо согласие на обработку персональных данных', 'error');
        return { success: false, error: 'Нет согласия' };
    }
    
    try {
        const response = await fetch(`${App.apiUrl}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                phone,
                passport_data: passportData || null,
                pd_consent: consent
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            App.currentUser = data.user;
            Storage.set('user', App.currentUser);
            updateUIForAuth();
            showNotification('Регистрация успешна!', 'success');
            return { success: true, user: App.currentUser };
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return { success: false, error: 'Ошибка соединения' };
    }
}

// Вход
async function loginUser(email, password) {
    try {
        const response = await fetch(`${App.apiUrl}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            App.currentUser = data.user;
            Storage.set('user', App.currentUser);
            updateUIForAuth();
            showNotification(`Добро пожаловать, ${data.user.full_name}!`, 'success');
            return { success: true, user: App.currentUser };
        } else {
            showNotification(data.error || 'Неверный email или пароль', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return { success: false, error: 'Ошибка соединения' };
    }
}

// Выход
function logout() {
    App.currentUser = null;
    Storage.remove('user');
    updateUIForAuth();
    showNotification('Вы вышли из системы', 'info');
    
    // Перезагружаем страницу, если нужно
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
}

// Получить текущего пользователя
function getCurrentUser() {
    return App.currentUser;
}

// Проверить авторизован ли пользователь
function isAuthenticated() {
    return App.currentUser !== null;
}

// =====================================================
// ФУНКЦИИ МОДАЛЬНЫХ ОКОН
// =====================================================

// Открыть модальное окно входа
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
        // Очищаем форму
        const form = document.getElementById('loginForm');
        if (form) form.reset();
    } else {
        showNotification('Ошибка загрузки формы входа', 'error');
    }
}

// Открыть модальное окно регистрации
function openRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'flex';
        // Очищаем форму
        const form = document.getElementById('registerForm');
        if (form) form.reset();
    } else {
        showNotification('Ошибка загрузки формы регистрации', 'error');
    }
}

// Открыть личный кабинет
async function openProfileModal() {
    if (!isAuthenticated()) {
        openLoginModal();
        return;
    }
    
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'flex';
        await loadProfileData();
    } else {
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

// Закрыть модальное окно
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Переключение между формами
function switchToRegister() {
    closeModal('loginModal');
    openRegisterModal();
}

function switchToLogin() {
    closeModal('registerModal');
    openLoginModal();
}

// =====================================================
// ФУНКЦИИ ПРОФИЛЯ
// =====================================================

// Загрузка данных в личный кабинет
async function loadProfileData() {
    const user = getCurrentUser();
    if (!user) return;
    
    const content = document.getElementById('profileContent');
    if (!content) return;
    
    content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка данных...</div>';
    
    try {
        // Загружаем статистику
        const statsResponse = await fetch(`${App.apiUrl}/stats/dashboard`);
        const statsData = await statsResponse.json();
        
        // Загружаем полисы пользователя
        const policiesResponse = await fetch(`${App.apiUrl}/policies/user/${user.id}`);
        const policiesData = await policiesResponse.json();
        
        // Загружаем выплаты
        const payoutsResponse = await fetch(`${App.apiUrl}/payouts/user/${user.id}`);
        const payoutsData = await payoutsResponse.json();
        
        // Формируем HTML
        content.innerHTML = `
            <div class="profile-info">
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <div class="profile-details">
                        <h3>${user.full_name || 'Пользователь'}</h3>
                        <p><i class="fas fa-envelope"></i> ${user.email}</p>
                        ${user.phone ? `<p><i class="fas fa-phone"></i> ${user.phone}</p>` : ''}
                        <p><i class="fas fa-calendar-alt"></i> Зарегистрирован: ${new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-card">
                        <div class="number">${statsData.stats?.total_policies || 0}</div>
                        <div class="label">Всего полисов</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${statsData.stats?.active_policies || 0}</div>
                        <div class="label">Активных</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${statsData.stats?.total_payouts || 0}</div>
                        <div class="label">Выплат</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">${statsData.stats?.total_payouts_rub || 0} ₽</div>
                        <div class="label">Получено выплат</div>
                    </div>
                </div>
            </div>
            
            <div class="profile-section">
                <h3>Мои страховые полисы</h3>
                <div class="policies-list">
                    ${renderPolicies(policiesData.policies || [])}
                </div>
            </div>
            
            <div class="profile-section">
                <h3>История выплат</h3>
                <div class="payouts-list">
                    ${renderPayouts(payoutsData.payouts || [])}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        content.innerHTML = '<div class="loading">Ошибка загрузки данных. Попробуйте позже.</div>';
    }
}

// Рендер полисов
function renderPolicies(policies) {
    if (!policies || policies.length === 0) {
        return '<p class="no-data"><i class="fas fa-file-alt"></i> У вас пока нет страховых полисов</p>';
    }
    
    return policies.map(policy => `
        <div class="policy-item">
            <div class="policy-header">
                <span class="policy-number">${policy.policy_number || 'POL-' + policy.id}</span>
                <span class="policy-status status-${policy.status}">${getStatusText(policy.status)}</span>
            </div>
            <div class="policy-details">
                <div><i class="fas fa-plane"></i> <strong>Рейс:</strong> ${policy.flight_number}</div>
                <div><i class="fas fa-calendar"></i> <strong>Дата вылета:</strong> ${new Date(policy.departure_date).toLocaleDateString()}</div>
                <div><i class="fas fa-map-marker-alt"></i> <strong>Маршрут:</strong> ${policy.departure_airport || '???'} → ${policy.arrival_airport || '???'}</div>
                <div><i class="fas fa-ruble-sign"></i> <strong>Сумма:</strong> ${policy.total_price_rub} ₽</div>
                ${policy.contract_address ? `<div><i class="fas fa-link"></i> <strong>Контракт:</strong> ${policy.contract_address.substring(0, 10)}...</div>` : ''}
            </div>
        </div>
    `).join('');
}

// Рендер выплат
function renderPayouts(payouts) {
    if (!payouts || payouts.length === 0) {
        return '<p class="no-data"><i class="fas fa-coins"></i> Выплат пока не было</p>';
    }
    
    return payouts.map(payout => `
        <div class="payout-item">
            <div class="payout-info">
                <div class="payout-risk"><i class="fas fa-exclamation-triangle"></i> ${getRiskText(payout.risk_code)}</div>
                <div class="payout-date"><i class="fas fa-clock"></i> ${new Date(payout.created_at).toLocaleDateString()}</div>
                ${payout.policy_number ? `<div class="payout-policy"><i class="fas fa-file-contract"></i> Полис: ${payout.policy_number}</div>` : ''}
            </div>
            <div class="payout-amount">
                ${payout.amount_rub} ₽
                <span class="currency">(${payout.amount_ton} TON)</span>
            </div>
        </div>
    `).join('');
}

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

function getStatusText(status) {
    const statuses = {
        'active': 'Активен',
        'expired': 'Истек',
        'draft': 'Черновик',
        'paid': 'Оплачен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

function getRiskText(riskCode) {
    const risks = {
        'flight_delay_2h': 'Задержка рейса 2-4 часа',
        'flight_delay_4h': 'Задержка рейса 4-6 часов',
        'flight_delay_6h': 'Задержка рейса более 6 часов',
        'flight_cancellation': 'Отмена рейса',
        'alternate_airport': 'Посадка на запасной аэродром',
        'flight_delay': 'Задержка рейса'
    };
    return risks[riskCode] || riskCode;
}

// Функции для работы с localStorage (безопасное хранение)
const Storage = {
    set: (key, value) => {
        try {
            const encrypted = btoa(JSON.stringify(value));
            localStorage.setItem(key, encrypted);
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
        }
    },
    
    get: (key) => {
        const item = localStorage.getItem(key);
        if (item) {
            try {
                return JSON.parse(atob(item));
            } catch {
                return null;
            }
        }
        return null;
    },
    
    remove: (key) => {
        localStorage.removeItem(key);
    },
    
    clear: () => {
        localStorage.clear();
    }
};

// =====================================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// =====================================================

window.App = App;
window.Storage = Storage;
window.showNotification = showNotification;
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logout = logout;
window.openLoginModal = openLoginModal;
window.openRegisterModal = openRegisterModal;
window.openProfileModal = openProfileModal;
window.closeModal = closeModal;
window.switchToLogin = switchToLogin;
window.switchToRegister = switchToRegister;
window.loadProfileData = loadProfileData;