// =====================================================
// server.js - Бэкенд для ParamGuard (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// =====================================================

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// TON микросервис
const TON_SERVICE_URL = process.env.TON_SERVICE_URL || 'http://localhost:3004';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =====================================================
// ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ
// =====================================================
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'VKR'
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.stack);
    } else {
        console.log('✅ Подключено к PostgreSQL (VKR)');
        release();
    }
});

// =====================================================
// НАСТРОЙКА ПОЧТЫ (Yandex)
// =====================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Ошибка подключения к почте:', error);
    } else {
        console.log('✅ Почтовый сервер настроен (Yandex)');
    }
});

// =====================================================
// НАСТРОЙКА ЮKASSA
// =====================================================
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';
const shopId = process.env.YOOKASSA_SHOP_ID;
const secretKey = process.env.YOOKASSA_SECRET_KEY;
const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

// =====================================================
// ФУНКЦИИ ДЛЯ ВЫЗОВА TON МИКРОСЕРВИСА
// =====================================================

async function callTonDeploy(policyId, userWalletAddress, payoutAmountTon, risksMask) {
    try {
        console.log(`\n🚀 Вызов TON микросервиса для деплоя полиса ${policyId}`);
        
        const response = await axios.post(`${TON_SERVICE_URL}/api/ton/deploy`, {
            policyId: policyId,
            userAddress: userWalletAddress,
            payoutAmount: payoutAmountTon,
            risksMask: risksMask
        });
        
        if (response.data.success) {
            console.log(`✅ Контракт развернут: ${response.data.contract_address}`);
            return response.data;
        } else {
            console.error(`❌ Ошибка деплоя: ${response.data.error}`);
            return null;
        }
    } catch (error) {
        console.error('❌ Ошибка вызова TON микросервиса:', error.message);
        return null;
    }
}

async function getTonBalance() {
    try {
        const response = await axios.get(`${TON_SERVICE_URL}/api/ton/balance`);
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка получения баланса TON:', error.message);
        return { success: false, balance: 0, address: null };
    }
}

async function getTonContract(policyId) {
    try {
        const response = await axios.get(`${TON_SERVICE_URL}/api/ton/contract/${policyId}`);
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка получения контракта:', error.message);
        return null;
    }
}

// =====================================================
// API ЭНДПОИНТЫ
// =====================================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'VKR', time: new Date().toISOString() });
});

// =====================================================
// ПОЛЬЗОВАТЕЛИ
// =====================================================

app.post('/api/users/register', async (req, res) => {
    const { email, phone, full_name, password, birth_date, passport_data, pd_consent } = req.body;
    if (!pd_consent) {
        return res.status(400).json({ success: false, error: 'Необходимо согласие на обработку персональных данных' });
    }
    try {
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (email, phone, password_hash, full_name, birth_date, passport_data, pd_consent, pd_consent_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING id, email, full_name`,
            [email, phone, password_hash, full_name, birth_date, passport_data || null, true]
        );
        res.status(201).json({ success: true, user: result.rows[0], message: 'Пользователь успешно зарегистрирован' });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        if (err.code === '23505') {
            res.status(400).json({ success: false, error: 'Email уже используется' });
        } else {
            res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
    }
});

app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT id, email, password_hash, full_name FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        res.json({ success: true, user: { id: user.id, email: user.email, full_name: user.full_name } });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, full_name, phone, birth_date, created_at FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// РИСКИ
// =====================================================

app.get('/api/risks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM risks ORDER BY id');
        res.json({ success: true, risks: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/risks/travel', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM risks WHERE is_active = true ORDER BY payout_rub');
        res.json({ success: true, risks: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// ПОЛИСЫ
// =====================================================

app.post('/api/policies', async (req, res) => {
    const {
        user_id, insured_persons, flight_number, airline,
        departure_airport, arrival_airport, departure_date,
        departure_time, selected_risks, base_price_rub,
        total_price_rub, contract_price_ton, start_date, end_date,
        country, coverage
    } = req.body;
    
    try {
        const policyNumber = `POL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(6, '0')}`;
        
        let risksJson = selected_risks;
        if (Array.isArray(selected_risks)) {
            risksJson = JSON.stringify(selected_risks);
        }
        
        const processedDepartureTime = departure_time && departure_time.trim() !== '' ? departure_time : '12:00:00';
        
        const result = await pool.query(
            `INSERT INTO policies (
                user_id, policy_number, insured_persons, flight_number, airline,
                departure_airport, arrival_airport, departure_date,
                departure_time, selected_risks, base_price_rub,
                total_price_rub, contract_price_ton, start_date, end_date,
                country, coverage, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft')
            RETURNING *`,
            [
                user_id, policyNumber, insured_persons, flight_number, airline,
                departure_airport, arrival_airport, departure_date,
                processedDepartureTime, risksJson, base_price_rub,
                total_price_rub, contract_price_ton, start_date, end_date,
                country, coverage
            ]
        );
        
        const policy = result.rows[0];
        res.status(201).json({ success: true, policy });
    } catch (err) {
        console.error('Ошибка создания полиса:', err);
        res.status(500).json({ success: false, error: err.message || 'Ошибка сервера' });
    }
});
// app.get('/api/policies/user/:userId', async (req, res) => {
//     try {
//         const result = await pool.query(`SELECT * FROM policies WHERE user_id = $1 ORDER BY created_at DESC`, [req.params.userId]);
//         res.json({ success: true, policies: result.rows });
//     } catch (err) {
//         res.status(500).json({ success: false, error: 'Ошибка сервера' });
//     }
// });


// app.get('/api/policies/user/:userId', async (req, res) => {
//     try {
//         const result = await pool.query(`
//             SELECT 
//                 id, policy_number, flight_number, airline,
//                 departure_airport, arrival_airport,
//                 to_char(departure_date, 'YYYY-MM-DD') as departure_date,
//                 departure_time,
//                 selected_risks, total_price_rub, status, payment_status,
//                 contract_address, created_at
//             FROM policies 
//             WHERE user_id = $1 
//             ORDER BY created_at DESC
//         `, [req.params.userId]);
//         res.json({ success: true, policies: result.rows });
//     } catch (err) {
//         console.error('Ошибка получения полисов:', err);
//         res.status(500).json({ success: false, error: 'Ошибка сервера' });
//     }
// });


app.get('/api/policies/user/:userId', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, policy_number, flight_number, airline,
                   departure_airport, arrival_airport, departure_date, departure_time,
                   selected_risks, total_price_rub, status, payment_status,
                   contract_address, created_at, country, coverage
            FROM policies 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [req.params.userId]);
        res.json({ success: true, policies: result.rows });
    } catch (err) {
        console.error('Ошибка получения полисов:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});



app.get('/api/policies/id/:id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT p.*, u.email, u.full_name, u.phone FROM policies p JOIN users u ON p.user_id = u.id WHERE p.id = $1`, [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден' });
        }
        res.json({ success: true, policy: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/policies/:policyNumber', async (req, res) => {
    try {
        const result = await pool.query(`SELECT p.*, u.email, u.full_name, u.phone FROM policies p JOIN users u ON p.user_id = u.id WHERE p.policy_number = $1`, [req.params.policyNumber]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден' });
        }
        res.json({ success: true, policy: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.patch('/api/policies/:id/activate', async (req, res) => {
    const { contract_address, contract_transaction_hash } = req.body;
    try {
        const result = await pool.query(
            `UPDATE policies SET status = 'active', activated_at = CURRENT_TIMESTAMP, contract_address = $1, contract_transaction_hash = $2, contract_created_at = CURRENT_TIMESTAMP WHERE id = $3 AND status = 'draft' RETURNING *`,
            [contract_address, contract_transaction_hash, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден или уже активирован' });
        }
        res.json({ success: true, policy: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЮKASSA
// =====================================================

app.post('/api/payments/create', async (req, res) => {
    const { policy_id, amount_rub, description, user_id } = req.body;
    try {
        // УБРАЛИ u.wallet_address - этой колонки нет
        const policyResult = await pool.query(`SELECT p.*, u.email, u.full_name FROM policies p JOIN users u ON p.user_id = u.id WHERE p.id = $1`, [policy_id]);
        
        if (policyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден' });
        }
        const policy = policyResult.rows[0];
        
        const response = await axios.post(
            `${YOOKASSA_API_URL}/payments`,
            {
                amount: { value: (amount_rub || parseFloat(policy.total_price_rub)).toFixed(2), currency: 'RUB' },
                capture: true,
                confirmation: { type: 'redirect', return_url: `http://localhost:3000/pages/payment-success.html?policy_id=${policy_id}` },
                description: description || `Страховой полис ${policy.policy_number || policy.id}`,
                metadata: { policy_id, user_id, policy_number: policy.policy_number }
            },
            { 
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Basic ${auth}`, 
                    'Idempotence-Key': crypto.randomUUID() 
                } 
            }
        );
        
        await pool.query(
            `INSERT INTO payments (user_id, policy_id, amount_rub, payment_method, payment_status, yookassa_payment_id, yookassa_status, yookassa_response) 
             VALUES ($1, $2, $3, 'yookassa', 'pending', $4, $5, $6)`,
            [user_id, policy_id, amount_rub || policy.total_price_rub, response.data.id, response.data.status, response.data]
        );
        
        res.json({ success: true, payment_url: response.data.confirmation.confirmation_url, payment_id: response.data.id });
    } catch (error) {
        console.error('Ошибка создания платежа:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.description || 'Ошибка создания платежа' });
    }
});

// Webhook для получения статуса платежа от ЮKassa
app.post('/api/webhooks/yookassa', async (req, res) => {
    console.log('📨 Получен вебхук:', JSON.stringify(req.body, null, 2));
    
    try {
        const { object } = req.body;
        
        if (!object || !object.id) {
            console.log('⚠️ Неверный формат вебхука');
            return res.status(200).json({ received: true });
        }
        
        if (object.status === 'succeeded') {
            const paymentResult = await pool.query(
                `SELECT policy_id FROM payments 
                 WHERE yookassa_payment_id::text = $1::text`,
                [String(object.id)]
            );
            
            if (paymentResult.rows.length > 0) {
                const { policy_id } = paymentResult.rows[0];
                
                // Обновляем статус платежа
                await pool.query(
                    `UPDATE payments 
                     SET payment_status = 'completed',
                         yookassa_status = 'succeeded',
                         completed_at = CURRENT_TIMESTAMP
                     WHERE yookassa_payment_id::text = $1::text`,
                    [String(object.id)]
                );
                
                // Получаем данные полиса (без wallet_address)
                const policyResult = await pool.query(
                    `SELECT p.*, u.id as user_id 
                     FROM policies p 
                     JOIN users u ON p.user_id = u.id 
                     WHERE p.id = $1`,
                    [policy_id]
                );
                
                if (policyResult.rows.length > 0) {
                    const policy = policyResult.rows[0];
                    
                    // Активируем полис
                    await pool.query(
                        `UPDATE policies 
                         SET status = 'active',
                             payment_status = 'paid',
                             activated_at = CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [policy_id]
                    );
                    
                    console.log(`✅ Полис ${policy_id} активирован после оплаты`);
                    
                    // ========== ДЕПЛОЙ КОНТРАКТА ==========
                    // Используем дефолтный TON адрес
                    const defaultWallet = process.env.TON_WALLET_ADDRESS || 'EQAvJxDz3n41pMI9dfTeyVHCkPAS6UD1MtH7MB1xyh3mZZVW';
                    
                    try {
                        // Парсим выбранные риски
                        let risksArray = [];
                        if (policy.selected_risks) {
                            if (typeof policy.selected_risks === 'string') {
                                if (policy.selected_risks.startsWith('[')) {
                                    risksArray = JSON.parse(policy.selected_risks);
                                } else {
                                    risksArray = policy.selected_risks.split(',').map(r => r.trim());
                                }
                            } else if (Array.isArray(policy.selected_risks)) {
                                risksArray = policy.selected_risks;
                            }
                        }
                        
                        // Создаем маску рисков
                        let risksMask = 0;
                        const riskMapping = {
                            'flight_delay': 1,
                            'flight_cancellation': 2,
                            'baggage_loss': 4,
                            'weather_rain': 8,
                            'weather_storm': 16,
                            'cold': 32
                        };
                        
                        for (const risk of risksArray) {
                            if (riskMapping[risk]) {
                                risksMask |= riskMapping[risk];
                            }
                        }
                        if (risksMask === 0) risksMask = 127;
                        
                        // Рассчитываем сумму выплаты в TON
                        const payoutAmountTon = parseFloat(policy.total_price_rub) / 60;
                        
                        console.log(`🚀 Деплой контракта для полиса ${policy_id}`);
                        console.log(`   Адрес пользователя: ${defaultWallet}`);
                        console.log(`   Сумма выплаты: ${payoutAmountTon} TON`);
                        console.log(`   Маска рисков: ${risksMask}`);
                        
                        // Вызываем TON микросервис
                        const contractResult = await callTonDeploy(
                            policy.id,
                            defaultWallet,
                            payoutAmountTon,
                            risksMask
                        );
                        
                        if (contractResult && contractResult.success) {
                            console.log(`✅ Смарт-контракт развернут: ${contractResult.contract_address}`);
                            
                            // Сохраняем адрес контракта в БД
                            await pool.query(
                                `UPDATE policies 
                                 SET contract_address = $1,
                                     contract_created_at = CURRENT_TIMESTAMP,
                                     contract_tx_hash = $2
                                 WHERE id = $3`,
                                [contractResult.contract_address, contractResult.transaction_hash, policy_id]
                            );
                            
                            // Создаем уведомление
                            await pool.query(
                                `INSERT INTO notifications (user_id, policy_id, notification_type, title, message)
                                 VALUES ($1, $2, 'info', '🔗 Смарт-контракт создан',
                                         'Смарт-контракт для вашего полиса развернут в TON testnet. Адрес: ${contractResult.contract_address}')`,
                                [policy.user_id, policy.id]
                            );
                        } else {
                            console.error(`❌ Ошибка деплоя контракта для полиса ${policy_id}`);
                        }
                    } catch (contractError) {
                        console.error('❌ Ошибка создания смарт-контракта:', contractError);
                    }
                    // ================================================================
                }
            } else {
                console.log(`⚠️ Платеж ${object.id} не найден в БД`);
            }
        }
        
        res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('❌ Ошибка обработки webhook:', error);
        res.status(200).json({ received: true, error: error.message });
    }
});

app.get('/api/payments/status/:payment_id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT payment_status, yookassa_status, completed_at FROM payments WHERE yookassa_payment_id = $1`, [req.params.payment_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Платеж не найден' });
        }
        res.json({ success: true, payment: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// REDSTONE ORACLE ЭНДПОИНТЫ
// =====================================================

app.get('/api/oracle/status', (req, res) => {
    res.json({
        success: true,
        running: true,
        message: 'RedStone Oracle',
        sources: ['aviationstack'],
        apiKey: process.env.AVIATIONSTACK_KEY ? '✅ настроен' : '❌ не настроен'
    });
});

app.get('/api/oracle/flight/:flightNumber', async (req, res) => {
    const { flightNumber } = req.params;
    const apiKey = process.env.AVIATIONSTACK_KEY;
    
    if (!apiKey) {
        return res.json({
            success: true,
            source: 'simulation',
            data: { flight: flightNumber, status: 'scheduled', delay: 0, message: 'API ключ не настроен' }
        });
    }
    
    try {
        const response = await axios.get('https://api.aviationstack.com/v1/flights', {
            params: { access_key: apiKey, flight_iata: flightNumber, limit: 1 },
            timeout: 10000
        });
        
        if (response.data?.data?.length > 0) {
            const flight = response.data.data[0];
            res.json({
                success: true,
                source: 'aviationstack',
                data: {
                    flight: flight.flight?.iata,
                    status: flight.flight_status,
                    delay: flight.departure?.delay || 0,
                    airline: flight.airline?.name,
                    departure: flight.departure?.airport,
                    arrival: flight.arrival?.airport,
                    scheduled: flight.departure?.scheduled,
                    actual: flight.departure?.actual
                }
            });
        } else {
            res.json({ success: false, source: 'aviationstack', message: 'Рейс не найден' });
        }
    } catch (error) {
        console.error('AviationStack error:', error.message);
        res.json({ success: false, source: 'error', message: error.message });
    }
});

app.post('/api/oracle/webhook', async (req, res) => {
    console.log('📨 Получены данные от RedStone Oracle:', JSON.stringify(req.body, null, 2));
    try {
        await pool.query(
            `INSERT INTO flight_monitoring (policy_id, flight_number, flight_status, delay_minutes, data_source, raw_response, processed) 
             VALUES (NULL, $1, $2, $3, 'redstone', $4, false)`,
            [req.body.flight_data?.flight, req.body.flight_data?.status, req.body.flight_data?.delay || 0, JSON.stringify(req.body)]
        );
        res.json({ success: true, received: true });
    } catch (error) {
        console.error('Ошибка обработки webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// TON ЭНДПОИНТЫ (через микросервис)
// =====================================================

app.get('/api/ton/balance', async (req, res) => {
    try {
        const result = await getTonBalance();
        res.json(result);
    } catch (error) {
        res.json({ success: false, balance: 0, address: null, error: error.message });
    }
});

app.get('/api/ton/contract/:policyId', async (req, res) => {
    try {
        const result = await getTonContract(parseInt(req.params.policyId));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// ПЛАТЕЖИ (внутренние)
// =====================================================

app.post('/api/payments', async (req, res) => {
    const { user_id, policy_id, amount_rub, payment_method } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO payments (user_id, policy_id, amount_rub, payment_method, payment_status) 
             VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
            [user_id, policy_id, amount_rub, payment_method]
        );
        res.status(201).json({ success: true, payment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/payments/confirm', async (req, res) => {
    const { payment_id, yookassa_payment_id, yookassa_status } = req.body;
    try {
        await pool.query('BEGIN');
        const paymentResult = await pool.query(
            `UPDATE payments 
             SET payment_status = 'completed', 
                 yookassa_payment_id = $2, 
                 yookassa_status = $3, 
                 completed_at = CURRENT_TIMESTAMP 
             WHERE id = $1 
             RETURNING policy_id`,
            [payment_id, yookassa_payment_id, yookassa_status]
        );
        if (paymentResult.rows.length > 0) {
            await pool.query(
                `UPDATE policies 
                 SET payment_status = 'paid', 
                     status = 'active', 
                     activated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1`,
                [paymentResult.rows[0].policy_id]
            );
        }
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// МОНИТОРИНГ РЕЙСОВ
// =====================================================

app.post('/api/flight-monitoring', async (req, res) => {
    const { policy_id, flight_number, flight_status, delay_minutes, actual_departure, actual_arrival, scheduled_departure, scheduled_arrival, data_source, raw_response } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO flight_monitoring (policy_id, flight_number, flight_status, delay_minutes, actual_departure, actual_arrival, scheduled_departure, scheduled_arrival, data_source, raw_response) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [policy_id, flight_number, flight_status, delay_minutes, actual_departure, actual_arrival, scheduled_departure, scheduled_arrival, data_source, raw_response]
        );
        res.status(201).json({ success: true, monitoring: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/flight-monitoring/:policyId/latest', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM flight_monitoring 
             WHERE policy_id = $1 
             ORDER BY check_time DESC LIMIT 1`,
            [req.params.policyId]
        );
        res.json({ success: true, monitoring: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// ВЫПЛАТЫ
// =====================================================

app.get('/api/payouts/user/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, pol.policy_number, pol.flight_number 
             FROM payouts p 
             JOIN policies pol ON p.policy_id = pol.id 
             WHERE p.user_id = $1 
             ORDER BY p.created_at DESC`,
            [req.params.userId]
        );
        res.json({ success: true, payouts: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/payouts/recent', async (req, res) => {
    const { limit = 5 } = req.query;
    try {
        const result = await pool.query(
            `SELECT po.id, po.payout_number, po.amount_rub, po.amount_ton, po.risk_code, po.created_at, po.status, 
                    u.full_name as user_name, p.flight_number 
             FROM payouts po 
             JOIN users u ON po.user_id = u.id 
             LEFT JOIN policies p ON po.policy_id = p.id 
             WHERE po.status = 'completed' 
             ORDER BY po.created_at DESC 
             LIMIT $1`,
            [limit]
        );
        res.json({ success: true, payouts: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, payouts: [] });
    }
});

// =====================================================
// ОТПРАВКА СООБЩЕНИЙ НА ПОЧТУ
// =====================================================

app.post('/api/contact/send', async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    const subjectMap = { 
        'policy': 'Оформление полиса', 
        'payment': 'Вопросы оплаты', 
        'payout': 'Выплаты', 
        'tech': 'Техническая поддержка', 
        'other': 'Другое' 
    };
    const subjectText = subjectMap[subject] || subject;
    
    const html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body{font-family:Arial,sans-serif;}
            .header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;}
            .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;}
            .message-box{background:white;padding:15px;border-left:4px solid #764ba2;margin-top:15px;}
        </style>
    </head>
    <body>
        <div class="header">
            <h2>ParamGuard</h2>
            <p>Новое сообщение с сайта</p>
        </div>
        <div class="content">
            <div><strong>Отправитель:</strong> ${name}</div>
            <div><strong>Email:</strong> <a href="mailto:${email}">${email}</a></div>
            ${phone ? `<div><strong>Телефон:</strong> ${phone}</div>` : ''}
            <div><strong>Тема:</strong> ${subjectText}</div>
            <div class="message-box">
                <strong>Сообщение:</strong><br>
                ${message.replace(/\n/g, '<br>')}
            </div>
            <div><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</div>
        </div>
    </body>
    </html>`;
    
    try {
        await transporter.sendMail({ 
            from: `"ParamGuard" <${process.env.EMAIL_USER}>`, 
            to: process.env.EMAIL_TO || process.env.EMAIL_USER, 
            subject: `📧 ParamGuard: ${subjectText} от ${name}`, 
            html: html, 
            replyTo: email 
        });
        console.log('✅ Письмо отправлено');
        
        try {
            await pool.query(
                `INSERT INTO contact_messages (name, email, phone, subject, message, sent_at) 
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
                [name, email, phone, subjectText, message]
            );
        } catch (dbError) { 
            console.log('⚠️ Ошибка сохранения в БД:', dbError.message); 
        }
        
        res.json({ success: true, message: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.' });
    } catch (error) {
        console.error('❌ Ошибка отправки письма:', error);
        res.status(500).json({ success: false, error: 'Ошибка отправки сообщения. Попробуйте позже.' });
    }
});

// =====================================================
// СТАТИСТИКА
// =====================================================

app.get('/api/stats/dashboard', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM get_dashboard_stats()');
        res.json({ success: true, stats: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/stats/active-flights', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM v_active_flights');
        res.json({ success: true, flights: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/stats/pending-payouts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM v_pending_payouts');
        res.json({ success: true, payouts: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// КОШЕЛЕК КОМПАНИИ
// =====================================================

app.get('/api/wallet/balance', async (req, res) => {
    try {
        const result = await pool.query('SELECT wallet_address, balance_ton, network FROM company_wallet WHERE id = 1');
        res.json({ success: true, wallet: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/wallet/update', async (req, res) => {
    const { amount, operation } = req.body;
    try {
        const result = await pool.query('SELECT update_company_balance($1, $2) as new_balance', [amount, operation]);
        res.json({ success: true, balance: result.rows[0].new_balance });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// УПРАВЛЕНИЕ ПОЛИСАМИ
// =====================================================

app.put('/api/policies/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const policyCheck = await pool.query('SELECT payment_status FROM policies WHERE id = $1', [id]);
        if (policyCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден' });
        }
        if (policyCheck.rows[0].payment_status === 'paid') {
            return res.status(400).json({ success: false, error: 'Нельзя редактировать оплаченный полис' });
        }
        
        const result = await pool.query(
            `UPDATE policies 
             SET flight_number = COALESCE($1, flight_number), 
                 airline = COALESCE($2, airline), 
                 departure_airport = COALESCE($3, departure_airport), 
                 arrival_airport = COALESCE($4, arrival_airport), 
                 departure_date = COALESCE($5, departure_date), 
                 departure_time = COALESCE($6, departure_time), 
                 country = COALESCE($7, country), 
                 selected_risks = COALESCE($8, selected_risks), 
                 base_price_rub = COALESCE($9, base_price_rub), 
                 total_price_rub = COALESCE($10, total_price_rub), 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $11 
             RETURNING *`,
            [updates.flight_number, updates.airline, updates.departure_airport, updates.arrival_airport, 
             updates.departure_date, updates.departure_time, updates.country, updates.selected_risks, 
             updates.base_price_rub, updates.total_price_rub, id]
        );
        res.json({ success: true, policy: result.rows[0] });
    } catch (err) {
        console.error('Ошибка обновления полиса:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.delete('/api/policies/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const policyCheck = await pool.query('SELECT payment_status FROM policies WHERE id = $1', [id]);
        if (policyCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Полис не найден' });
        }
        if (policyCheck.rows[0].payment_status === 'paid') {
            return res.status(400).json({ success: false, error: 'Нельзя удалить оплаченный полис' });
        }
        await pool.query('DELETE FROM policies WHERE id = $1', [id]);
        res.json({ success: true, message: 'Полис удален' });
    } catch (err) {
        console.error('Ошибка удаления полиса:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЧЕРНОВИКИ
// =====================================================

app.post('/api/policies/draft', async (req, res) => {
    const { user_id, draft_data } = req.body;
    if (!user_id || !draft_data) {
        return res.status(400).json({ success: false, error: 'Не указаны обязательные поля' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO policy_drafts (user_id, draft_data, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             ON CONFLICT (user_id) 
             DO UPDATE SET draft_data = $2, updated_at = CURRENT_TIMESTAMP 
             RETURNING *`,
            [user_id, draft_data]
        );
        res.json({ success: true, draft: result.rows[0], message: 'Черновик сохранен' });
    } catch (err) {
        console.error('Ошибка сохранения черновика:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения черновика' });
    }
});

app.get('/api/policies/draft/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT draft_data, updated_at FROM policy_drafts WHERE user_id = $1', [req.params.userId]);
        res.json({ success: true, draft: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка получения черновика' });
    }
});

app.delete('/api/policies/draft/:userId', async (req, res) => {
    try {
        await pool.query('DELETE FROM policy_drafts WHERE user_id = $1', [req.params.userId]);
        res.json({ success: true, message: 'Черновик удален' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка удаления черновика' });
    }
});

app.get('/api/policies/drafts/user/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, draft_data, created_at, updated_at FROM policy_drafts WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.params.userId]
        );
        res.json({ success: true, drafts: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/policies/draft/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM policy_drafts WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Черновик не найден' });
        }
        res.json({ success: true, draft: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.delete('/api/policies/draft/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM policy_drafts WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Черновик удален' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// УВЕДОМЛЕНИЯ
// =====================================================

app.post('/api/notifications', async (req, res) => {
    const { user_id, policy_id, notification_type, title, message, amount_rub, amount_ton, risk_code } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, policy_id, notification_type, title, message, amount_rub, amount_ton, risk_code) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [user_id, policy_id, notification_type, title, message, amount_rub, amount_ton, risk_code]
        );
        res.json({ success: true, notification: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/notifications/user/:userId', async (req, res) => {
    const { limit = 20, unread_only = false } = req.query;
    try {
        let query = `SELECT n.*, p.policy_number, p.flight_number 
                     FROM notifications n 
                     LEFT JOIN policies p ON n.policy_id = p.id 
                     WHERE n.user_id = $1`;
        const params = [req.params.userId];
        if (unread_only === 'true') {
            query += ` AND n.is_read = false`;
        }
        query += ` ORDER BY n.created_at DESC LIMIT $2`;
        params.push(limit);
        const result = await pool.query(query, params);
        res.json({ success: true, notifications: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = CURRENT_TIMESTAMP 
             WHERE id = $1 
             RETURNING *`,
            [req.params.id]
        );
        res.json({ success: true, notification: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.patch('/api/notifications/user/:userId/read-all', async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 AND is_read = false`,
            [req.params.userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.delete('/api/notifications/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM notifications WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЗАПУСК СЕРВЕРА
// =====================================================

async function startServer() {
    console.log('🔄 Инициализация сервера ParamGuard...');
    
    // Проверяем доступность TON микросервиса
    try {
        const tonStatus = await axios.get(`${TON_SERVICE_URL}/api/ton/status`);
        console.log(`✅ TON микросервис доступен: ${TON_SERVICE_URL}`);
        console.log(`   Статус: ${JSON.stringify(tonStatus.data)}`);
    } catch (error) {
        console.log(`⚠️ TON микросервис не доступен: ${TON_SERVICE_URL}`);
        console.log(`   Контракты будут разворачиваться позже автоматически`);
    }
    
    // Запускаем HTTP сервер
    const server = app.listen(PORT, () => {
        console.log(`
    ════════════════════════════════════════════════════════════════
    🚀 ParamGuard Server успешно запущен!
    ════════════════════════════════════════════════════════════════
    📡 Порт: ${PORT}
    🌐 URL: http://localhost:${PORT}
    🗄️  База данных: VKR (PostgreSQL)
    📧 Почта: ${process.env.EMAIL_USER || 'Не настроена'}
    💳 ЮKassa: ${shopId ? '✅ Настроена' : '❌ Не настроена'}
    🔗 TON микросервис: ${TON_SERVICE_URL}
    📡 RedStone Oracle: ${process.env.AVIATIONSTACK_KEY ? '✅ Настроен' : '❌ Симуляция'}
    📁 Режим: ${process.env.NODE_ENV || 'development'}
    ════════════════════════════════════════════════════════════════
    
    Доступные эндпоинты:
    • GET  /api/health - Проверка статуса
    • POST /api/users/register - Регистрация
    • POST /api/users/login - Вход
    • POST /api/policies - Создание полиса
    • POST /api/payments/create - Создание платежа
    • POST /api/webhooks/yookassa - Webhook ЮKassa
    • GET  /api/ton/balance - Баланс TON кошелька
    • GET  /api/oracle/flight/:number - Информация о рейсе
    
    📝 Логи сервера будут отображаться ниже:
    ════════════════════════════════════════════════════════════════
        `);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('🛑 Получен сигнал SIGTERM, закрываю соединения...');
        server.close(async () => {
            await pool.end();
            console.log('✅ Все соединения закрыты');
            process.exit(0);
        });
    });
    
    return server;
}

// Запускаем сервер
startServer().catch(error => {
    console.error('❌ Критическая ошибка при запуске сервера:', error);
    process.exit(1);
});