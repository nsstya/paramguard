// js/profile.js - Общий код для отображения профиля на всех страницах

// Получаем базовый URL API
const getApiUrl = () => window.API_URL || 'http://localhost:3000';

// Функция для безопасных fetch запросов (с игнорированием предупреждения ngrok)
async function safeFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',  // Игнорируем предупреждение ngrok
        ...(options.headers || {})
    };
    
    // Определяем полный URL
    let finalUrl;
    if (url.startsWith('http')) {
        finalUrl = url;
    } else if (url.startsWith('/api')) {
        const apiUrl = getApiUrl();
        finalUrl = `${apiUrl}${url}`;
    } else {
        const apiUrl = getApiUrl();
        finalUrl = `${apiUrl}/api/${url}`;
    }
    
    console.log(`🔗 safeFetch: ${options.method || 'GET'} ${finalUrl}`);
    
    try {
        const response = await fetch(finalUrl, {
            ...options,
            headers,
            credentials: 'include'
        });
        return response;
    } catch (error) {
        console.error('❌ Ошибка safeFetch:', error);
        throw error;
    }
}

// Функция загрузки данных профиля
async function loadProfileData() {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
        if (typeof showNotification === 'function') showNotification('Необходимо войти в систему', 'warning');
        if (typeof openLoginModal === 'function') openLoginModal();
        return;
    }
    
    const user = JSON.parse(savedUser);
    const content = document.getElementById('profileContent');
    if (!content) return;
    
    content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка данных...</div>';
    
    try {
        // Загружаем полисы пользователя
        let policies = [];
        try {
            const response = await safeFetch(`/api/policies/user/${user.id}`);
            const data = await response.json();
            policies = data.success ? data.policies : [];
            console.log(`✅ Загружено полисов: ${policies.length}`);
        } catch (e) {
            console.error('Ошибка загрузки полисов:', e);
        }
        
        // Загружаем черновики
        let drafts = [];
        try {
            const draftsResponse = await safeFetch(`/api/policies/drafts/user/${user.id}`);
            const draftsData = await draftsResponse.json();
            drafts = draftsData.success ? draftsData.drafts : [];
            console.log(`✅ Загружено черновиков: ${drafts.length}`);
        } catch (e) {
            console.error('Ошибка загрузки черновиков:', e);
        }
        
        const totalPolicies = policies.length;
        const paidPolicies = policies.filter(p => p.payment_status === 'paid' || p.status === 'active').length;
        const draftPolicies = drafts.length;
        
        content.innerHTML = `
            <div class="profile-info">
                <div class="profile-header">
                    <div class="profile-avatar">${user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</div>
                    <div class="profile-details">
                        <h3>${escapeHtml(user.full_name || 'Пользователь')}</h3>
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
                        ${user.phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(user.phone)}</p>` : ''}
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-card"><div class="number">${totalPolicies}</div><div class="label">Всего полисов</div></div>
                    <div class="stat-card"><div class="number">${paidPolicies}</div><div class="label">Оплаченных</div></div>
                    <div class="stat-card"><div class="number">${draftPolicies}</div><div class="label">Черновиков</div></div>
                </div>
            </div>
            
            <div class="profile-section">
                <h3>📋 Мои страховые полисы</h3>
                <div class="policies-list" id="policiesList">
                    ${renderPoliciesSimple(policies)}
                </div>
            </div>
            
            <div class="profile-section">
                <h3>📝 Сохраненные черновики</h3>
                <div class="drafts-list" id="draftsList">
                    ${renderDraftsList(drafts)}
                </div>
            </div>
            
            <div class="profile-section">
                <h3>🔔 Уведомления о выплатах</h3>
                <div id="notificationsList" class="notifications-list">
                    <div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка уведомлений...</div>
                </div>
            </div>
            
            <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <button onclick="logout()" style="
                    padding: 12px 30px;
                    background: #f5222d;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                " onmouseover="this.style.background='#ff4d4f'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#f5222d'; this.style.transform='translateY(0)'">
                    <i class="fas fa-sign-out-alt"></i> Выйти из аккаунта
                </button>
            </div>
        `;
        
        // Загружаем уведомления после вставки HTML
        setTimeout(() => {
            loadNotifications();
        }, 100);
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        content.innerHTML = '<div class="loading">Ошибка загрузки данных. Попробуйте позже.</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function renderPoliciesSimple(policies) {
    if (!policies || policies.length === 0) {
        return '<p class="no-data"><i class="fas fa-file-alt"></i> У вас пока нет страховых полисов.<br><a href="/pages/insurance-travel.html" style="color: #764ba2;">Оформить первый полис</a></p>';
    }
    
    return policies.map(policy => {
        let departureDateStr = '—';
        if (policy.departure_date) {
            if (typeof policy.departure_date === 'string' && policy.departure_date.includes('T')) {
                departureDateStr = policy.departure_date.split('T')[0];
            } else {
                departureDateStr = policy.departure_date;
            }
        }
        
        const isPaid = policy.payment_status === 'paid' || policy.status === 'active';
        
        return `
        <div class="policy-item" style="margin-bottom: 15px; border-radius: 12px; background: white; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: 700; color: #764ba2;">${escapeHtml(policy.policy_number || 'POL-' + policy.id)}</span>
                <span style="padding: 2px 8px; border-radius: 20px; font-size: 12px; background: ${isPaid ? '#52c41a' : '#faad14'}; color: white;">
                    ${isPaid ? 'Активен' : 'Черновик'}
                </span>
            </div>
            <div><strong>Рейс:</strong> ${escapeHtml(policy.flight_number || '—')}</div>
            <div><strong>Авиакомпания:</strong> ${escapeHtml(policy.airline || '—')}</div>
            <div><strong>Маршрут:</strong> ${escapeHtml(policy.departure_airport || '—')} → ${escapeHtml(policy.arrival_airport || '—')}</div>
            <div><strong>Дата вылета:</strong> ${escapeHtml(departureDateStr)} ${escapeHtml(policy.departure_time || '')}</div>
            <div><strong>Страна:</strong> ${escapeHtml(policy.country || '—')}</div>
            <div><strong>Выбранные риски:</strong> ${getRiskNames(policy.selected_risks)}</div>
            <div><strong>Сумма покрытия:</strong> ${policy.coverage ? policy.coverage.toLocaleString() + ' ₽' : '—'}</div>
            <div><strong>Стоимость полиса:</strong> ${policy.total_price_rub?.toLocaleString() || 0} ₽</div>
            <div style="margin-top: 10px;">
                ${!isPaid ? `
                    <button onclick="payPolicy(${policy.id})" style="padding: 5px 15px; background: #52c41a; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        Оплатить
                    </button>
                    <button onclick="editPolicy(${policy.id})" style="padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Редактировать
                    </button>
                ` : `
                    <button onclick="downloadPolicy(${policy.id})" style="padding: 5px 15px; background: #764ba2; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Скачать полис
                    </button>
                `}
            </div>
        </div>
    `}).join('');
}

function getRiskNames(selectedRisksJson) {
    if (!selectedRisksJson) return '—';
    
    let risks = [];
    try {
        risks = typeof selectedRisksJson === 'string' ? JSON.parse(selectedRisksJson) : selectedRisksJson;
    } catch(e) {
        risks = [];
    }
    
    const riskNames = {
        'flight_delay': 'Задержка рейса',
        'flight_cancellation': 'Отмена рейса',
        'alternate_airport': 'Посадка на запасной аэродром',
        'baggage_loss': 'Потеря багажа',
        'heavy_rain': 'Сильный дождь',
        'storm_warning': 'Штормовое предупреждение',
        'cold_weather': 'Аномальный холод'
    };
    
    return risks.map(r => riskNames[r] || r).join(', ') || '—';
}

function renderDraftsList(drafts) {
    if (!drafts || drafts.length === 0) {
        return '<p class="no-data"><i class="fas fa-file-alt"></i> У вас нет сохраненных черновиков.<br><a href="/pages/insurance-travel.html" style="color: #764ba2;">Создать новый полис</a></p>';
    }
    
    return drafts.map(draft => {
        const draftData = draft.draft_data;
        const updatedAt = new Date(draft.updated_at).toLocaleString();
        const flightNumber = draftData?.flightNumber || '—';
        const country = draftData?.country || '—';
        
        return `
            <div class="draft-card" id="draft-${draft.id}" style="margin-bottom: 15px; border-radius: 12px; background: white; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div class="draft-header" style="padding: 15px; background: #fff7e6; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="background: #faad14; color: white; padding: 2px 8px; border-radius: 20px; font-size: 12px;">Черновик</span>
                        <span style="margin-left: 10px; font-size: 12px; color: #666;">Сохранен: ${escapeHtml(updatedAt)}</span>
                    </div>
                    <div>
                        <i class="fas fa-chevron-down" id="draft-chevron-${draft.id}" style="cursor: pointer; transition: transform 0.3s;" onclick="toggleDraftDetails(${draft.id})"></i>
                    </div>
                </div>
                <div class="draft-details" id="draft-details-${draft.id}" style="display: none; padding: 20px; border-top: 1px solid #e0e0e0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div><strong>Рейс:</strong> ${escapeHtml(flightNumber)}</div>
                        <div><strong>Страна:</strong> ${escapeHtml(country)}</div>
                        <div><strong>Страхователь:</strong> ${escapeHtml(draftData?.fullName || '—')}</div>
                        <div><strong>Дата вылета:</strong> ${escapeHtml(draftData?.departureDate || '—')}</div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="continueDraft(${draft.id})" class="btn-continue" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-edit"></i> Продолжить заполнение
                        </button>
                        <button onclick="deleteDraftById(${draft.id})" class="btn-delete" style="padding: 8px 20px; background: #f5222d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDraftDetails(draftId) {
    const details = document.getElementById(`draft-details-${draftId}`);
    const chevron = document.getElementById(`draft-chevron-${draftId}`);
    if (details && chevron) {
        if (details.style.display === 'none' || details.style.display === '') {
            details.style.display = 'block';
            chevron.style.transform = 'rotate(180deg)';
        } else {
            details.style.display = 'none';
            chevron.style.transform = 'rotate(0deg)';
        }
    }
}

async function continueDraft(draftId) {
    try {
        const response = await safeFetch(`/api/policies/draft/${draftId}`);
        const data = await response.json();
        if (data.success && data.draft) {
            localStorage.setItem('load_draft_data', JSON.stringify(data.draft.draft_data));
            window.location.href = '/pages/insurance-travel.html?load_draft=' + draftId;
        } else {
            if (typeof showNotification === 'function') showNotification('Ошибка загрузки черновика', 'error');
        }
    } catch (error) {
        console.error('Ошибка загрузки черновика:', error);
        if (typeof showNotification === 'function') showNotification('Ошибка загрузки черновика', 'error');
    }
}

async function deleteDraftById(draftId) {
    if (!confirm('Удалить этот черновик?')) return;
    
    try {
        const response = await safeFetch(`/api/policies/draft/${draftId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            if (typeof showNotification === 'function') showNotification('Черновик удален', 'success');
            loadProfileData();
        } else {
            if (typeof showNotification === 'function') showNotification('Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления черновика:', error);
        if (typeof showNotification === 'function') showNotification('Ошибка удаления черновика', 'error');
    }
}

// =====================================================
// УВЕДОМЛЕНИЯ
// =====================================================

async function loadNotifications() {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    
    const user = JSON.parse(savedUser);
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    notificationsList.style.wordBreak = 'break-word';
    notificationsList.style.whiteSpace = 'normal';
    notificationsList.style.maxWidth = '100%';
    
    notificationsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка уведомлений...</div>';
    
    try {
        const response = await safeFetch(`/api/notifications/user/${user.id}?limit=20`);
        const data = await response.json();
        
        if (data.success && data.notifications && data.notifications.length > 0) {
            notificationsList.innerHTML = data.notifications.map(notif => `
                <div class="notification-item ${notif.is_read ? 'read' : 'unread'}" id="notif-${notif.id}" style="
                    background: ${notif.is_read ? '#fff' : '#f8f7ff'};
                    border-left: 4px solid ${notif.notification_type === 'payout' ? '#52c41a' : '#764ba2'};
                    margin-bottom: 12px;
                    padding: 15px;
                    border-radius: 12px;
                    transition: all 0.3s;
                    cursor: pointer;
                    word-break: break-word;
                    white-space: normal;
                " onclick="markNotificationRead(${notif.id})">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="fas ${notif.notification_type === 'payout' ? 'fa-coins' : 'fa-bell'}" style="color: ${notif.notification_type === 'payout' ? '#52c41a' : '#764ba2'};"></i>
                            <strong style="color: #333;">${escapeHtml(notif.title)}</strong>
                        </div>
                        <span style="font-size: 12px; color: #999;">${new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <div style="color: #666; margin-bottom: 8px; word-break: break-word; overflow-wrap: break-word;">${escapeHtml(notif.message)}</div>
                    ${notif.amount_rub ? `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                            <span style="font-size: 18px; font-weight: 800; color: #52c41a;">${notif.amount_rub.toLocaleString()} ₽</span>
                            ${notif.amount_ton ? `<span style="font-size: 12px; color: #999;"> (${notif.amount_ton} TON)</span>` : ''}
                        </div>
                    ` : ''}
                    ${notif.policy_number ? `
                        <div style="margin-top: 8px; font-size: 12px; color: #999; word-break: break-word;">
                            <i class="fas fa-file-contract"></i> Полис: ${escapeHtml(notif.policy_number)}
                        </div>
                    ` : ''}
                </div>
            `).join('');
            
            if (data.notifications.some(n => !n.is_read)) {
                const markAllBtn = document.createElement('div');
                markAllBtn.style.textAlign = 'right';
                markAllBtn.style.marginBottom = '15px';
                markAllBtn.innerHTML = `
                    <button onclick="markAllNotificationsRead()" style="
                        background: none;
                        border: none;
                        color: #764ba2;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        <i class="fas fa-check-double"></i> Отметить все как прочитанные
                    </button>
                `;
                notificationsList.insertBefore(markAllBtn, notificationsList.firstChild);
            }
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-bell-slash" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <p>У вас нет уведомлений</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
        notificationsList.innerHTML = '<div class="loading">Ошибка загрузки уведомлений</div>';
    }
}

async function markNotificationRead(notificationId) {
    try {
        const response = await safeFetch(`/api/notifications/${notificationId}/read`, {
            method: 'PATCH'
        });
        const data = await response.json();
        if (data.success) {
            const notifElement = document.getElementById(`notif-${notificationId}`);
            if (notifElement) {
                notifElement.style.background = '#fff';
                notifElement.classList.remove('unread');
                notifElement.classList.add('read');
            }
            updateNotificationCount();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function markAllNotificationsRead() {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    
    const user = JSON.parse(savedUser);
    
    try {
        const response = await safeFetch(`/api/notifications/user/${user.id}/read-all`, {
            method: 'PATCH'
        });
        const data = await response.json();
        if (data.success) {
            await loadNotifications();
            updateNotificationCount();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function updateNotificationCount() {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    
    const user = JSON.parse(savedUser);
    
    try {
        const response = await safeFetch(`/api/notifications/user/${user.id}?unread_only=true&limit=100`);
        const data = await response.json();
        const unreadCount = data.success ? data.notifications.length : 0;
        
        const bellIcon = document.querySelector('.notification-bell');
        if (bellIcon) {
            if (unreadCount > 0) {
                bellIcon.innerHTML = `<i class="fas fa-bell"></i><span class="badge">${unreadCount}</span>`;
            } else {
                bellIcon.innerHTML = `<i class="fas fa-bell"></i>`;
            }
        }
        
        localStorage.setItem('unread_notifications', unreadCount);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

async function createPayoutNotification(userId, policyId, amountRub, amountTon, riskCode, policyNumber) {
    try {
        const response = await safeFetch(`/api/notifications`, {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                policy_id: policyId,
                notification_type: 'payout',
                title: '💰 Назначена выплата!',
                message: `По страховому полису ${policyNumber} назначена выплата в связи с наступлением страхового случая.`,
                amount_rub: amountRub,
                amount_ton: amountTon,
                risk_code: riskCode
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log(`✅ Уведомление о выплате создано для пользователя ${userId}`);
            updateNotificationCount();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
        return false;
    }
}

// Делаем функции глобальными
window.loadProfileData = loadProfileData;
window.toggleDraftDetails = toggleDraftDetails;
window.continueDraft = continueDraft;
window.deleteDraftById = deleteDraftById;
window.loadNotifications = loadNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.updateNotificationCount = updateNotificationCount;
window.createPayoutNotification = createPayoutNotification;
window.safeFetch = safeFetch;
