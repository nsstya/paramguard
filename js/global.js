// js/global.js
// Убираем дублирование - API_URL будет только в index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 global.js инициализирован');
    
    // Загружаем шапку
    fetch('/components/header.html')
        .then(r => r.text())
        .then(html => {
            const header = document.getElementById('header');
            if (header) {
                header.innerHTML = html;
                console.log('✅ Шапка загружена');
                // Обновляем иконку после загрузки шапки
                if (typeof updateUserIcon === 'function') {
                    updateUserIcon();
                }
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
    
    // Загружаем окно профиля
    fetch('/components/profile-modal.html')
        .then(r => r.text())
        .then(html => {
            const profileModal = document.getElementById('profileModal');
            if (profileModal) {
                profileModal.innerHTML = html;
                console.log('✅ Окно профиля загружено');
            }
        })
        .catch(e => console.error('❌ Ошибка загрузки окна профиля:', e));
});

// Функция обновления иконки
function updateUserIcon() {
    const savedUser = localStorage.getItem('user');
    const userIcon = document.querySelector('.user-icon');
    
    if (savedUser && userIcon) {
        const user = JSON.parse(savedUser);
        const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
        userIcon.innerHTML = `<span>${initial}</span>`;
        console.log('✅ Иконка обновлена:', initial);
    } else if (userIcon) {
        userIcon.innerHTML = '<i class="fas fa-user"></i>';
        console.log('❌ Пользователь не авторизован');
    }
}





// js/global.js - Добавить в конец файла

// =====================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ПОЛИСАМИ
// =====================================================

// Получить текущего пользователя
function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Получить все полисы пользователя
async function getUserPolicies() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const response = await fetch(`http://localhost:3000/api/policies/user/${user.id}`);
        const data = await response.json();
        return data.success ? data.policies : [];
    } catch (error) {
        console.error('Ошибка загрузки полисов:', error);
        return [];
    }
}

// Получить полис по ID
async function getPolicyById(policyId) {
    try {
        const response = await fetch(`http://localhost:3000/api/policies/id/${policyId}`);
        const data = await response.json();
        return data.success ? data.policy : null;
    } catch (error) {
        console.error('Ошибка загрузки полиса:', error);
        return null;
    }
}

// Удалить полис (только если не оплачен)
async function deletePolicy(policyId) {
    const policy = await getPolicyById(policyId);
    if (policy && policy.payment_status === 'paid') {
        showNotification('Нельзя удалить оплаченный полис', 'error');
        return false;
    }
    
    try {
        const response = await fetch(`http://localhost:3000/api/policies/${policyId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Полис удален', 'success');
            if (typeof loadProfileData === 'function') {
                loadProfileData();
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка удаления полиса:', error);
        return false;
    }
}

// Оплатить полис
async function payPolicy(policyId) {
    try {
        const policy = await getPolicyById(policyId);
        if (!policy) return false;
        
        const user = getCurrentUser();
        
        const response = await fetch(`http://localhost:3000/api/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                policy_id: policyId,
                amount_rub: policy.total_price_rub,
                description: `Страховой полис ${policy.policy_number || policyId}`,
                user_id: user.id
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.payment_url) {
            showNotification('Перенаправление на оплату...', 'success');
            setTimeout(() => {
                window.location.href = data.payment_url;
            }, 1500);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка оплаты полиса:', error);
        showNotification('Ошибка создания платежа', 'error');
        return false;
    }
}

// Получить название риска
function getRiskNameDisplay(riskCode) {
    const risks = {
        'flight_delay': 'Задержка рейса',
        'flight_cancellation': 'Отмена рейса',
        'alternate_airport': 'Посадка на запасной аэродром',
        'heavy_rain': 'Сильный дождь',
        'storm_warning': 'Штормовое предупреждение',
        'cold_weather': 'Аномальный холод'
    };
    return risks[riskCode] || riskCode;
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Специальная функция для форматирования даты вылета
function formatDepartureDate(date, time) {
    if (!date) return '—';
    
    // Проблема: date уже содержит время (например, "2026-03-27T00:00:00.000Z")
    // Нужно извлечь только дату и объединить с временем из поля time
    
    let dateOnly = date;
    
    // Если date содержит T, извлекаем только дату
    if (date.includes('T')) {
        dateOnly = date.split('T')[0];
    }
    
    // Если есть отдельное время, используем его
    let dateStr = dateOnly;
    if (time) {
        dateStr = dateOnly + 'T' + time;
    } else {
        dateStr = dateOnly + 'T00:00:00';
    }
    
    return formatDate(dateStr);
}

// Получить цвет статуса
function getStatusColor(policy) {
    if (policy.payment_status === 'paid') return '#52c41a';
    if (policy.status === 'draft') return '#faad14';
    return '#999';
}

// Получить текст статуса
function getStatusText(policy) {
    if (policy.payment_status === 'paid') return 'Оплачен';
    if (policy.status === 'draft') return 'Черновик';
    return policy.status;
}

// Рендер списка рисков
function renderRisksList(risksJson) {
    if (!risksJson) return '<span>—</span>';
    let risks = [];
    try {
        risks = typeof risksJson === 'string' ? JSON.parse(risksJson) : risksJson;
    } catch(e) {
        risks = [];
    }
    if (risks.length === 0) return '<span>Не выбраны</span>';
    return risks.map(r => `<span style="background: #e8e4ff; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${getRiskNameDisplay(r)}</span>`).join('');
}

// Переключение деталей полиса
function togglePolicyDetails(policyId) {
    const details = document.getElementById(`details-${policyId}`);
    const chevron = document.getElementById(`chevron-${policyId}`);
    if (details && chevron) {
        if (details.style.display === 'none') {
            details.style.display = 'block';
            chevron.style.transform = 'rotate(180deg)';
        } else {
            details.style.display = 'none';
            chevron.style.transform = 'rotate(0deg)';
        }
    }
}

// Редактировать полис
async function editPolicy(policyId) {
    const policy = await getPolicyById(policyId);
    if (!policy) return;
    
    localStorage.setItem('edit_policy_id', policyId);
    localStorage.setItem('edit_policy_data', JSON.stringify(policy));
    window.location.href = '/pages/insurance-travel.html?edit=' + policyId;
}

// Скачать полис
async function downloadPolicy(policyId) {
    const policy = await getPolicyById(policyId);
    if (!policy) return;
    
    showNotification('Функция скачивания полиса в разработке. Номер полиса: ' + (policy.policy_number || policyId), 'info');
}

// =====================================================
// ЧЕРНОВИКИ ПОЛИСОВ
// =====================================================

// Получить все черновики пользователя
async function getUserDrafts() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const response = await fetch(`http://localhost:3000/api/policies/drafts/user/${user.id}`);
        const data = await response.json();
        return data.success ? data.drafts : [];
    } catch (error) {
        console.error('Ошибка загрузки черновиков:', error);
        return [];
    }
}

// Загрузить черновик по ID
async function loadDraftById(draftId) {
    try {
        const response = await fetch(`http://localhost:3000/api/policies/draft/${draftId}`);
        const data = await response.json();
        if (data.success && data.draft) {
            return data.draft;
        }
        return null;
    } catch (error) {
        console.error('Ошибка загрузки черновика:', error);
        return null;
    }
}

// Удалить черновик по ID
async function deleteDraftById(draftId) {
    try {
        const response = await fetch(`http://localhost:3000/api/policies/draft/${draftId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Черновик удален', 'success');
            loadProfileData(); // Обновляем отображение
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка удаления черновика:', error);
        showNotification('Ошибка удаления черновика', 'error');
        return false;
    }
}

// Продолжить заполнение черновика
async function continueDraft(draftId) {
    const draft = await loadDraftById(draftId);
    if (draft) {
        localStorage.setItem('load_draft_id', draftId);
        localStorage.setItem('load_draft_data', JSON.stringify(draft.draft_data));
        window.location.href = '/pages/insurance-travel.html?load_draft=' + draftId;
    }
}




// Настройка клика на иконку для всех страниц
function setupUserIconClick() {
    const userIcon = document.querySelector('.user-icon');
    if (userIcon) {
        userIcon.onclick = function(e) {
            e.stopPropagation();
            console.log('🖱️ Клик по иконке');
            if (localStorage.getItem('user')) {
                openProfileModal();
            } else {
                openLoginModal();
            }
        };
    }
}

// Вызываем после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(setupUserIconClick, 200);
});


function openProfileModal() {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
        openLoginModal();
        return;
    }
    
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    if (profileModal) profileModal.style.display = 'flex';
    
    // Загружаем данные профиля
    if (typeof loadProfileData === 'function') {
        loadProfileData();
    }

    setTimeout(() => {
        if (typeof loadNotifications === 'function') {
            loadNotifications();
        }
    }, 300);
}


// Рендер списка полисов с возможностью развернуть
function renderPoliciesList(policies) {
    if (!policies || policies.length === 0) {
        return '<p class="no-data"><i class="fas fa-file-alt"></i> У вас пока нет страховых полисов.<br><a href="/pages/insurance-travel.html" style="color: #764ba2;">Оформить первый полис</a></p>';
    }
    
    return policies.map(policy => `
        <div class="policy-card" id="policy-${policy.id}" style="margin-bottom: 15px; border-radius: 12px; background: white; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div class="policy-header" style="padding: 15px; background: #f8f7ff; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="togglePolicyDetails(${policy.id})">
                <div>
                    <span class="policy-number" style="font-weight: 700; color: #764ba2;">${policy.policy_number || 'POL-' + policy.id}</span>
                    <span class="policy-status" style="margin-left: 10px; padding: 2px 8px; border-radius: 20px; font-size: 12px; background: ${getStatusColor(policy)}; color: white;">
                        ${getStatusText(policy)}
                    </span>
                </div>
                <div>
                    <i class="fas fa-chevron-down" id="chevron-${policy.id}" style="transition: transform 0.3s;"></i>
                </div>
            </div>
            <div class="policy-details" id="details-${policy.id}" style="display: none; padding: 20px; border-top: 1px solid #e0e0e0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div><strong>Рейс:</strong> ${policy.flight_number}</div>
                    <div><strong>Авиакомпания:</strong> ${policy.airline || '—'}</div>
                    <div><strong>Маршрут:</strong> ${policy.departure_airport || '?'} → ${policy.arrival_airport || '?'}</div>
                    <div><strong>Дата вылета:</strong> ${formatDepartureDate(policy.departure_date, policy.departure_time)}</div>
                    <div><strong>Страна:</strong> ${policy.country || '—'}</div>
                    <div><strong>Сумма покрытия:</strong> ${policy.coverage ? policy.coverage.toLocaleString() + ' ₽' : '—'}</div>
                </div>
                <div><strong>Выбранные риски:</strong></div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 15px;">
                    ${renderRisksList(policy.selected_risks)}
                </div>
                <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 15px 0;">
                    <div><strong>Стоимость полиса:</strong> ${policy.total_price_rub?.toLocaleString()} ₽</div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    ${policy.payment_status !== 'paid' ? `
                        <button onclick="editPolicy(${policy.id})" class="btn-edit" style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                        <button onclick="deletePolicy(${policy.id})" class="btn-delete" style="padding: 8px 20px; background: #f5222d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                        <button onclick="payPolicy(${policy.id})" class="btn-pay" style="padding: 8px 20px; background: #52c41a; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-credit-card"></i> Оплатить
                        </button>
                    ` : `
                        <button onclick="downloadPolicy(${policy.id})" class="btn-download" style="padding: 8px 20px; background: #764ba2; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-download"></i> Скачать полис
                        </button>
                    `}
                </div>
            </div>
        </div>
    `).join('');
}

// Экспорт функций
window.getCurrentUser = getCurrentUser;
window.getUserPolicies = getUserPolicies;
window.getPolicyById = getPolicyById;
window.deletePolicy = deletePolicy;
window.payPolicy = payPolicy;
window.getRiskNameDisplay = getRiskNameDisplay;
window.formatDate = formatDate;
window.togglePolicyDetails = togglePolicyDetails;
window.editPolicy = editPolicy;
window.downloadPolicy = downloadPolicy;
window.renderPoliciesList = renderPoliciesList;