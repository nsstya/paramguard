// insurance-travel.js - Полностью исправленная версия
// с сохранением черновиков в БД и ЮKassa

// Состояние формы (только транспортные риски, без потери багажа)
let selectedRisks = ['flight_delay', 'flight_cancellation'];
let selectedWeather = [];

// Функция обновления отображения цены
function updatePriceDisplay() {
    const coverageSelect = document.getElementById('coverage');
    const priceRubElement = document.getElementById('totalPriceRub');
    const priceBreakdown = document.getElementById('priceBreakdown');
    
    if (!coverageSelect || !priceRubElement) {
        console.warn('⚠️ Элементы для отображения цены не найдены');
        return;
    }
    
    const coverage = parseInt(coverageSelect.value) || 250000;
    const riskCount = selectedRisks.length + selectedWeather.length;
    
    let price = coverage * 0.2;
    price += price * (riskCount * 0.05);
    const finalPrice = Math.round(price);
    
    priceRubElement.textContent = finalPrice.toLocaleString() + ' ₽';
    
    if (priceBreakdown) {
        const basePrice = coverage * 0.2;
        const riskBonus = basePrice * (riskCount * 0.05);
        priceBreakdown.innerHTML = `
            Базовая (20% от ${coverage.toLocaleString()} ₽): ${Math.round(basePrice).toLocaleString()} ₽<br>
            Риски (${riskCount} шт., +5% каждый): +${Math.round(riskBonus).toLocaleString()} ₽
        `;
    }
    
    console.log(`💰 Цена обновлена: ${finalPrice.toLocaleString()} ₽ (покрытие: ${coverage.toLocaleString()} ₽, рисков: ${riskCount})`);
    return finalPrice;
}

// Функция расчета общей цены
function calculateTotalPrice() {
    const coverage = parseInt(document.getElementById('coverage')?.value || 250000);
    const riskCount = selectedRisks.length + selectedWeather.length;
    let price = coverage * 0.2;
    price += price * (riskCount * 0.05);
    return Math.round(price);
}

// Обработчик изменения рисков
function updateRisks(event) {
    const value = event.target.value;
    if (event.target.checked) {
        if (!selectedRisks.includes(value)) selectedRisks.push(value);
    } else {
        selectedRisks = selectedRisks.filter(r => r !== value);
    }
    updatePriceDisplay();
}

// Обработчик изменения погодных рисков
function updateWeather(event) {
    const value = event.target.value;
    if (event.target.checked) {
        if (!selectedWeather.includes(value)) selectedWeather.push(value);
    } else {
        selectedWeather = selectedWeather.filter(w => w !== value);
    }
    updatePriceDisplay();
}

// Получение выбранных рисков
function getSelectedRisks() {
    const risks = [];
    document.querySelectorAll('input[name="risk"]:checked').forEach(cb => risks.push(cb.value));
    document.querySelectorAll('input[name="weather"]:checked').forEach(cb => risks.push(cb.value));
    return risks;
}

// Инициализация страницы
function initializeTravelPage() {
    console.log('🚀 Инициализация страницы страхования');
    
    const today = new Date().toISOString().split('T')[0];
    const departureDate = document.getElementById('departureDate');
    const birthDate = document.getElementById('insuredBirthDate');
    
    if (departureDate) {
        departureDate.min = today;
    }
    if (birthDate) {
        birthDate.max = today;
    }
    
    // Устанавливаем значения по умолчанию
    const countryInput = document.getElementById('country');
    const coverageSelect = document.getElementById('coverage');
    
    if (countryInput && !countryInput.value) {
        countryInput.value = 'Турция';
        console.log('✅ Установлена страна по умолчанию: Турция');
    }
    
    if (coverageSelect && !coverageSelect.value) {
        coverageSelect.value = '250000';
        console.log('✅ Установлено покрытие по умолчанию: 250000');
    }
    
    // Навешиваем обработчики событий
    const riskCheckboxes = document.querySelectorAll('input[name="risk"]');
    const weatherCheckboxes = document.querySelectorAll('input[name="weather"]');
    
    riskCheckboxes.forEach(cb => {
        cb.removeEventListener('change', updateRisks);
        cb.addEventListener('change', updateRisks);
    });
    
    weatherCheckboxes.forEach(cb => {
        cb.removeEventListener('change', updateWeather);
        cb.addEventListener('change', updateWeather);
    });
    
    if (coverageSelect) {
        coverageSelect.removeEventListener('change', updatePriceDisplay);
        coverageSelect.addEventListener('change', updatePriceDisplay);
    }
    
    // Принудительно обновляем цену
    setTimeout(() => {
        updatePriceDisplay();
    }, 100);
    
    console.log(`✅ Инициализация завершена. Найдено рисков: ${riskCheckboxes.length}, погодных: ${weatherCheckboxes.length}`);
}

// Проверка авторизации
function checkAuthAndShowWarning() {
    const user = localStorage.getItem('user');
    const existingWarning = document.getElementById('authWarning');
    
    if (!user) {
        if (!existingWarning) {
            createAuthWarning();
        } else {
            existingWarning.style.display = 'block';
        }
        
        const form = document.getElementById('travelInsuranceForm');
        if (form) {
            const inputs = form.querySelectorAll('input, select, button');
            inputs.forEach(input => { input.disabled = true; });
            form.style.opacity = '0.6';
            form.style.pointerEvents = 'none';
        }
        
        showNotification('Для оформления страховки необходимо войти или зарегистрироваться', 'warning');
    } else {
        if (existingWarning) existingWarning.style.display = 'none';
        
        const form = document.getElementById('travelInsuranceForm');
        if (form) {
            const inputs = form.querySelectorAll('input, select, button');
            inputs.forEach(input => { input.disabled = false; });
            form.style.opacity = '1';
            form.style.pointerEvents = 'auto';
        }
        
        fillUserData();
    }
}

// Создание предупреждения об авторизации
function createAuthWarning() {
    const formSection = document.querySelector('.form-section');
    if (!formSection) return;
    
    const warningHtml = `
        <div id="authWarning" style="background: linear-gradient(135deg, #fff7e6, #fff0d6); border-left: 4px solid #faad14; border-radius: 16px; padding: 30px; margin-bottom: 30px; text-align: center;">
            <i class="fas fa-lock" style="font-size: 48px; color: #faad14; margin-bottom: 15px;"></i>
            <h3 style="color: #333;">Требуется авторизация</h3>
            <p style="color: #666; margin-bottom: 20px;">Для оформления страхового полиса необходимо войти в личный кабинет или зарегистрироваться.</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="openLoginModal()" style="padding: 12px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; cursor: pointer;">Войти</button>
                <button onclick="openRegisterModal()" style="padding: 12px 30px; background: white; color: #764ba2; border: 2px solid #764ba2; border-radius: 10px; cursor: pointer;">Зарегистрироваться</button>
            </div>
        </div>
    `;
    formSection.insertAdjacentHTML('afterbegin', warningHtml);
}

// Заполнение данных пользователя
function fillUserData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    
    const fullNameInput = document.getElementById('insuredFullName');
    const emailInput = document.getElementById('insuredEmail');
    const phoneInput = document.getElementById('insuredPhone');
    
    if (fullNameInput && user.full_name) fullNameInput.value = user.full_name;
    if (emailInput && user.email) emailInput.value = user.email;
    if (phoneInput && user.phone) phoneInput.value = user.phone;
}

// Валидация формы страхования
function validateInsuranceForm() {
    const user = localStorage.getItem('user');
    if (!user) {
        showNotification('Для оформления страховки необходимо войти в систему', 'warning');
        openLoginModal();
        return false;
    }
    
    const passportData = document.getElementById('passportData')?.value;
    if (!passportData) {
        showNotification('Введите паспортные данные', 'warning');
        return false;
    }
    const passportRegex = /^\d{4}\s?\d{6}$/;
    if (!passportRegex.test(passportData.replace(/\s/g, ''))) {
        showNotification('Введите паспорт в формате: 1234 567890', 'warning');
        return false;
    }
    
    const flightNumber = document.getElementById('flightNumber')?.value;
    if (flightNumber) {
        const flightRegex = /^[A-Z]{2}\d{1,4}$/i;
        if (!flightRegex.test(flightNumber)) {
            showNotification('Введите номер рейса в формате: SU1234', 'warning');
            return false;
        }
    }
    
    const departureAirport = document.getElementById('departureAirport')?.value;
    const arrivalAirport = document.getElementById('arrivalAirport')?.value;
    const airportRegex = /^[A-Z]{3}$/i;
    
    if (departureAirport && !airportRegex.test(departureAirport)) {
        showNotification('Код аэропорта вылета должен состоять из 3 букв (SVO, LED)', 'warning');
        return false;
    }
    if (arrivalAirport && !airportRegex.test(arrivalAirport)) {
        showNotification('Код аэропорта прилета должен состоять из 3 букв (SVO, LED)', 'warning');
        return false;
    }
    
    const fullName = document.getElementById('insuredFullName')?.value;
    if (!fullName) {
        showNotification('Введите ФИО', 'warning');
        return false;
    }
    
    const birthDate = document.getElementById('insuredBirthDate')?.value;
    if (!birthDate) {
        showNotification('Введите дату рождения', 'warning');
        return false;
    }
    
    return true;
}

// Валидация формы путешествия
function validateTravelForm() {
    const required = ['country', 'departureDate', 'flightNumber', 'coverage'];
    
    for (const field of required) {
        const element = document.getElementById(field);
        if (!element || !element.value) {
            showNotification(`Пожалуйста, заполните поле ${field}`, 'warning');
            return false;
        }
    }
    return true;
}

// Сохранение черновика
async function saveDraft() {
    const user = localStorage.getItem('user');
    if (!user) {
        showNotification('Для сохранения черновика необходимо войти в систему', 'warning');
        openLoginModal();
        return;
    }
    
    const userData = JSON.parse(user);
    
    const draftData = {
        fullName: document.getElementById('insuredFullName')?.value || '',
        birthDate: document.getElementById('insuredBirthDate')?.value || '',
        email: document.getElementById('insuredEmail')?.value || '',
        phone: document.getElementById('insuredPhone')?.value || '',
        passportData: document.getElementById('passportData')?.value || '',
        flightNumber: document.getElementById('flightNumber')?.value || '',
        airline: document.getElementById('airline')?.value || '',
        departureAirport: document.getElementById('departureAirport')?.value || '',
        arrivalAirport: document.getElementById('arrivalAirport')?.value || '',
        departureDate: document.getElementById('departureDate')?.value || '',
        departureTime: document.getElementById('departureTime')?.value || '',
        country: document.getElementById('country')?.value || '',
        selectedRisks: getSelectedRisks(),
        coverage: document.getElementById('coverage')?.value || '250000'
    };
    
    try {
        const response = await fetch('http://localhost:3000/api/policies/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userData.id,
                draft_data: draftData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Черновик сохранен!', 'success');
        } else {
            showNotification(result.error || 'Ошибка сохранения черновика', 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения черновика:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Загрузка черновика из БД
async function loadDraftFromDB() {
    const user = localStorage.getItem('user');
    if (!user) return;
    
    const userData = JSON.parse(user);
    
    try {
        const response = await fetch(`http://localhost:3000/api/policies/draft/${userData.id}`);
        const result = await response.json();
        
        if (result.success && result.draft) {
            const draft = result.draft.draft_data;
            const updatedAt = new Date(result.draft.updated_at).toLocaleString();
            
            const shouldLoad = confirm(`У вас есть сохраненный черновик от ${updatedAt}. Загрузить его?`);
            
            if (shouldLoad) {
                fillFormFromDraft(draft);
                showNotification('Черновик загружен!', 'success');
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки черновика:', error);
    }
}

// Загрузка черновика из URL
function loadDraftFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('load_draft');
    
    if (draftId) {
        const savedDraftData = localStorage.getItem('load_draft_data');
        if (savedDraftData) {
            const draft = JSON.parse(savedDraftData);
            fillFormFromDraft(draft);
            localStorage.removeItem('load_draft_data');
            showNotification('Черновик загружен!', 'success');
        } else {
            fetch(`http://localhost:3000/api/policies/draft/${draftId}`)
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.draft) {
                        fillFormFromDraft(data.draft.draft_data);
                        showNotification('Черновик загружен!', 'success');
                    }
                })
                .catch(e => console.error('Ошибка загрузки черновика:', e));
        }
    }
}

// Заполнение формы из черновика
function fillFormFromDraft(draft) {
    if (draft.fullName) document.getElementById('insuredFullName').value = draft.fullName;
    if (draft.birthDate) document.getElementById('insuredBirthDate').value = draft.birthDate;
    if (draft.email) document.getElementById('insuredEmail').value = draft.email;
    if (draft.phone) document.getElementById('insuredPhone').value = draft.phone;
    if (draft.passportData) document.getElementById('passportData').value = draft.passportData;
    if (draft.flightNumber) document.getElementById('flightNumber').value = draft.flightNumber;
    if (draft.airline) document.getElementById('airline').value = draft.airline;
    if (draft.departureAirport) document.getElementById('departureAirport').value = draft.departureAirport;
    if (draft.arrivalAirport) document.getElementById('arrivalAirport').value = draft.arrivalAirport;
    if (draft.departureDate) document.getElementById('departureDate').value = draft.departureDate;
    if (draft.departureTime) document.getElementById('departureTime').value = draft.departureTime;
    if (draft.country) document.getElementById('country').value = draft.country;
    if (draft.coverage) document.getElementById('coverage').value = draft.coverage;
    
    if (draft.selectedRisks && draft.selectedRisks.length > 0) {
        document.querySelectorAll('input[name="risk"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="weather"]').forEach(cb => cb.checked = false);
        
        draft.selectedRisks.forEach(risk => {
            const checkbox = document.querySelector(`input[value="${risk}"]`);
            if (checkbox) checkbox.checked = true;
        });
        
        selectedRisks = draft.selectedRisks.filter(r => 
            ['flight_delay', 'flight_cancellation', 'alternate_airport'].includes(r)
        );
        selectedWeather = draft.selectedRisks.filter(r => 
            ['heavy_rain', 'storm_warning', 'cold_weather'].includes(r)
        );
    }
    
    updatePriceDisplay();
}

// Очистка черновика
async function clearDraft() {
    const user = localStorage.getItem('user');
    if (!user) return;
    
    const userData = JSON.parse(user);
    
    try {
        const response = await fetch(`http://localhost:3000/api/policies/draft/${userData.id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            showNotification('Черновик удален', 'info');
        }
    } catch (error) {
        console.error('Ошибка удаления черновика:', error);
    }
}

// =====================================================
// ОСНОВНАЯ ФУНКЦИЯ ОФОРМЛЕНИЯ (с интеграцией ЮKassa)
// =====================================================

async function processTravelPayment() {
    console.log('=== DEBUG processTravelPayment ===');
    console.log('country element:', document.getElementById('country'));
    console.log('country value:', document.getElementById('country')?.value);
    console.log('coverage element:', document.getElementById('coverage'));
    console.log('coverage value:', document.getElementById('coverage')?.value);
    console.log('===================================');
    
    const user = localStorage.getItem('user');
    if (!user) {
        showNotification('Для оформления страховки необходимо войти в систему', 'warning');
        openLoginModal();
        return;
    }
    
    const button = document.querySelector('.btn-primary');
    if (!button) return;
    
    if (!validateTravelForm()) return;
    if (!validateInsuranceForm()) return;
    
    button.disabled = true;
    button.textContent = 'Создание полиса...';
    
    try {
        const userData = JSON.parse(user);
        
        const countryInput = document.getElementById('country');
        const coverageSelect = document.getElementById('coverage');
        
        let selectedCountry = '';
        let selectedCoverage = 250000;
        
        if (countryInput) {
            selectedCountry = countryInput.value;
            console.log('Страна из input:', selectedCountry);
        } else {
            console.error('Элемент country не найден!');
            throw new Error('Поле "Страна назначения" не найдено на странице');
        }
        
        if (coverageSelect) {
            selectedCoverage = parseInt(coverageSelect.value);
            console.log('Сумма покрытия из select:', selectedCoverage);
        } else {
            console.error('Элемент coverage не найден!');
            throw new Error('Поле "Сумма покрытия" не найдено на странице');
        }
        
        if (!selectedCountry) {
            throw new Error('Пожалуйста, укажите страну назначения');
        }
        
        if (isNaN(selectedCoverage) || selectedCoverage <= 0) {
            selectedCoverage = 250000;
            console.log('Используем значение по умолчанию для покрытия:', selectedCoverage);
        }
        
        const formData = {
            fullName: document.getElementById('insuredFullName')?.value || '',
            birthDate: document.getElementById('insuredBirthDate')?.value || '',
            email: document.getElementById('insuredEmail')?.value || '',
            phone: document.getElementById('insuredPhone')?.value || '',
            passportData: document.getElementById('passportData')?.value || '',
            flightNumber: document.getElementById('flightNumber')?.value || '',
            airline: document.getElementById('airline')?.value || '',
            departureAirport: document.getElementById('departureAirport')?.value || '',
            arrivalAirport: document.getElementById('arrivalAirport')?.value || '',
            departureDate: document.getElementById('departureDate')?.value || '',
            departureTime: document.getElementById('departureTime')?.value || '12:00:00',
            country: selectedCountry,
            coverage: selectedCoverage,
            selectedRisks: getSelectedRisks()
        };
        
        const totalPrice = calculateTotalPrice();
        
        console.log('Отправляемые данные:', {
            country: formData.country,
            coverage: formData.coverage,
            totalPrice: totalPrice,
            selectedRisks: formData.selectedRisks
        });
        
        // 1. Создаем полис в БД
        const policyResponse = await fetch('http://localhost:3000/api/policies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userData.id,
                insured_persons: JSON.stringify([{
                    full_name: formData.fullName,
                    birth_date: formData.birthDate,
                    passport: formData.passportData
                }]),
                flight_number: formData.flightNumber,
                airline: formData.airline,
                departure_airport: formData.departureAirport,
                arrival_airport: formData.arrivalAirport,
                departure_date: formData.departureDate,
                departure_time: formData.departureTime,
                country: formData.country,
                coverage: formData.coverage,
                selected_risks: JSON.stringify(formData.selectedRisks),
                base_price_rub: totalPrice,
                total_price_rub: totalPrice,
                contract_price_ton: totalPrice / 60,
                start_date: new Date(formData.departureDate + 'T' + formData.departureTime).toISOString(),
                end_date: new Date(new Date(formData.departureDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        
        const policyData = await policyResponse.json();
        
        if (!policyData.success) {
            throw new Error(policyData.error || 'Ошибка создания полиса');
        }
        
        const policy = policyData.policy;
        
        await clearDraft();
        
        button.textContent = 'Создание платежа...';
        
        // 2. Создаем платеж через ЮKassa
        const paymentResponse = await fetch('http://localhost:3000/api/payments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                policy_id: policy.id,
                amount_rub: totalPrice,
                description: `Страховой полис ${policy.policy_number || policy.id}`,
                user_id: userData.id
            })
        });
        
        const paymentData = await paymentResponse.json();
        
        if (paymentData.success && paymentData.payment_url) {
            showNotification('Перенаправление на оплату...', 'success');
            localStorage.setItem('current_payment_id', paymentData.payment_id);
            localStorage.setItem('current_policy_id', policy.id);
            
            setTimeout(() => {
                window.location.href = paymentData.payment_url;
            }, 1500);
        } else {
            showNotification(paymentData.error || 'Ошибка создания платежа', 'error');
            button.disabled = false;
            button.textContent = 'Оформить полис и оплатить';
        }
        
    } catch (error) {
        console.error('Ошибка при оформлении:', error);
        showNotification(error.message || 'Произошла ошибка. Пожалуйста, попробуйте снова.', 'warning');
        button.disabled = false;
        button.textContent = 'Оформить полис и оплатить';
    }
}

// Принудительная инициализация при загрузке страницы
function initPage() {
    console.log('🌟 Insurance Travel - принудительная инициализация');
    
    if (window.location.pathname.includes('insurance-travel.html')) {
        checkAuthAndShowWarning();
        initializeTravelPage();
        loadDraftFromDB();
        loadDraftFromUrl();
    }
}

// Запускаем инициализацию несколькими способами для надежности
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// Также запускаем через setTimeout для надежности
setTimeout(initPage, 500);

// Экспорт функций в глобальную область
window.processTravelPayment = processTravelPayment;
window.saveDraft = saveDraft;
window.clearDraft = clearDraft;
window.updatePriceDisplay = updatePriceDisplay;
window.calculateTotalPrice = calculateTotalPrice;
window.getSelectedRisks = getSelectedRisks;
window.selectedRisks = selectedRisks;
window.selectedWeather = selectedWeather;