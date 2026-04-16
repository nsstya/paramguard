// // js/auth.js - Система авторизации
// class AuthService {
//     constructor() {
//         this.apiUrl = 'http://localhost:3000/api';
//         this.currentUser = null;
//         this.init();
//     }
    
//     async init() {
//         // Проверяем сохраненного пользователя
//         const savedUser = localStorage.getItem('user');
//         if (savedUser) {
//             this.currentUser = JSON.parse(savedUser);
//             this.updateUIForAuth();
//         }
        
//         // Проверяем токен
//         if (this.currentUser) {
//             await this.validateSession();
//         }
//     }
    
//     // Регистрация
//     async register(email, password, fullName, phone, passportData) {
//         try {
//             const response = await fetch(`${this.apiUrl}/users/register`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     email,
//                     password,
//                     full_name: fullName,
//                     phone,
//                     passport_data: passportData || null
//                 })
//             });
            
//             const data = await response.json();
            
//             if (data.success) {
//                 this.currentUser = data.user;
//                 localStorage.setItem('user', JSON.stringify(this.currentUser));
//                 this.updateUIForAuth();
//                 this.showNotification('Регистрация успешна!', 'success');
//                 return { success: true, user: this.currentUser };
//             } else {
//                 this.showNotification(data.error || 'Ошибка регистрации', 'error');
//                 return { success: false, error: data.error };
//             }
//         } catch (error) {
//             console.error('Ошибка регистрации:', error);
//             this.showNotification('Ошибка соединения с сервером', 'error');
//             return { success: false, error: 'Ошибка соединения' };
//         }
//     }
    
//     // Вход
//     async login(email, password) {
//         try {
//             const response = await fetch(`${this.apiUrl}/users/login`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ email, password })
//             });
            
//             const data = await response.json();
            
//             if (data.success) {
//                 this.currentUser = data.user;
//                 localStorage.setItem('user', JSON.stringify(this.currentUser));
//                 this.updateUIForAuth();
//                 this.showNotification(`Добро пожаловать, ${data.user.full_name}!`, 'success');
//                 return { success: true, user: this.currentUser };
//             } else {
//                 this.showNotification(data.error || 'Неверный email или пароль', 'error');
//                 return { success: false, error: data.error };
//             }
//         } catch (error) {
//             console.error('Ошибка входа:', error);
//             this.showNotification('Ошибка соединения с сервером', 'error');
//             return { success: false, error: 'Ошибка соединения' };
//         }
//     }
    
//     // Выход
//     logout() {
//         this.currentUser = null;
//         localStorage.removeItem('user');
//         this.updateUIForAuth();
//         this.showNotification('Вы вышли из системы', 'info');
//         window.location.reload();
//     }
    
//     // Проверка сессии
//     async validateSession() {
//         try {
//             const response = await fetch(`${this.apiUrl}/users/${this.currentUser.id}`);
//             const data = await response.json();
            
//             if (!data.success) {
//                 this.logout();
//             }
//         } catch (error) {
//             console.error('Ошибка проверки сессии:', error);
//         }
//     }
    
//     // Обновление UI в зависимости от авторизации
//     updateUIForAuth() {
//         const userIcon = document.querySelector('.user-icon');
//         const loginBtn = document.querySelector('#loginBtn');
//         const registerBtn = document.querySelector('#registerBtn');
//         const logoutBtn = document.querySelector('#logoutBtn');
//         const userMenu = document.querySelector('.user-menu');
        
//         if (this.currentUser) {
//             // Пользователь авторизован
//             if (userIcon) {
//                 userIcon.innerHTML = `<span>${this.currentUser.full_name.charAt(0)}</span>`;
//                 userIcon.title = this.currentUser.full_name;
//             }
            
//             if (loginBtn) loginBtn.style.display = 'none';
//             if (registerBtn) registerBtn.style.display = 'none';
//             if (logoutBtn) logoutBtn.style.display = 'block';
//             if (userMenu) userMenu.style.display = 'block';
            
//         } else {
//             // Пользователь не авторизован
//             if (userIcon) {
//                 userIcon.innerHTML = '<i class="fas fa-user"></i>';
//                 userIcon.title = 'Войти';
//             }
            
//             if (loginBtn) loginBtn.style.display = 'block';
//             if (registerBtn) registerBtn.style.display = 'block';
//             if (logoutBtn) logoutBtn.style.display = 'none';
//             if (userMenu) userMenu.style.display = 'none';
//         }
//     }
    
//     // Получить текущего пользователя
//     getUser() {
//         return this.currentUser;
//     }
    
//     // Проверить авторизован ли пользователь
//     isAuthenticated() {
//         return this.currentUser !== null;
//     }
    
//     // Показать уведомление
//     showNotification(message, type = 'info') {
//         const notification = document.getElementById('notification');
//         if (!notification) return;
        
//         const icon = {
//             success: 'fa-check-circle',
//             error: 'fa-exclamation-circle',
//             info: 'fa-info-circle',
//             warning: 'fa-exclamation-triangle'
//         };
        
//         notification.innerHTML = `
//             <i class="fas ${icon[type]}"></i>
//             <span>${message}</span>
//         `;
//         notification.className = `notification ${type}`;
//         notification.style.display = 'flex';
        
//         setTimeout(() => {
//             notification.style.display = 'none';
//         }, 3000);
//     }
// }

// // Создаем глобальный экземпляр
// window.authService = new AuthService();