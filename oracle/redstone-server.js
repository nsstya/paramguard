// // oracle/redstone-server.js - RedStone Oracle сервер (ФИНАЛЬНАЯ ВЕРСИЯ)
// // С автоматической перезагрузкой полисов и сохранением статуса в БД

// const express = require('express');
// const axios = require('axios');
// const { Pool } = require('pg');
// require('dotenv').config();

// const app = express();
// app.use(express.json());

// // TON сервис
// const TON_SERVICE_URL = process.env.TON_SERVICE_URL || 'http://localhost:3004';

// class RedStoneOracleServer {
//     constructor() {
//         this.pool = null;
//         this.monitoringInterval = null;
//         this.reloadInterval = null;
//         this.contracts = new Map();
//     }
    
//     async init() {
//         this.pool = new Pool({
//             user: process.env.DB_USER || 'postgres',
//             password: String(process.env.DB_PASSWORD || ''),
//             host: process.env.DB_HOST || 'localhost',
//             port: parseInt(process.env.DB_PORT || '5432'),
//             database: process.env.DB_NAME || 'VKR'
//         });
        
//         try {
//             const client = await this.pool.connect();
//             console.log('✅ Подключено к PostgreSQL');
//             client.release();
//         } catch (err) {
//             console.error('❌ Ошибка подключения к БД:', err.message);
//             return false;
//         }
        
//         console.log('✅ RedStone Oracle Server инициализирован');
        
//         await this.loadActiveContracts();
//         this.startMonitoring();
        
//         return true;
//     }
    
//     // Правильное формирование даты вылета
//     parseDepartureDateTime(departureDate, departureTime) {
//         if (!departureDate || !departureTime) return null;
//         try {
//             let year, month, day;
            
//             if (departureDate instanceof Date) {
//                 year = departureDate.getFullYear();
//                 month = departureDate.getMonth() + 1;
//                 day = departureDate.getDate();
//             } 
//             else if (typeof departureDate === 'string') {
//                 if (departureDate.includes('-')) {
//                     [year, month, day] = departureDate.split('-');
//                 } else if (departureDate.includes('/')) {
//                     [month, day, year] = departureDate.split('/');
//                 } else {
//                     const date = new Date(departureDate);
//                     if (!isNaN(date.getTime())) {
//                         year = date.getFullYear();
//                         month = date.getMonth() + 1;
//                         day = date.getDate();
//                     } else {
//                         throw new Error(`Неизвестный формат даты: ${departureDate}`);
//                     }
//                 }
//             } else {
//                 throw new Error(`Неизвестный тип даты: ${typeof departureDate}`);
//             }
            
//             const [hours, minutes, seconds] = departureTime.split(':');
//             const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
//                                   parseInt(hours), parseInt(minutes), parseInt(seconds || 0));
//             return date;
//         } catch (error) {
//             console.error(`Ошибка парсинга даты: ${departureDate} ${departureTime}`, error.message);
//             return null;
//         }
//     }
    
//     async loadActiveContracts() {
//         try {
//             const result = await this.pool.query(`
//                 SELECT p.id, p.policy_number, p.flight_number, p.departure_date,
//                        p.departure_time, p.selected_risks, p.contract_address,
//                        p.oracle_completed,
//                        u.email, u.full_name, u.id as user_id
//                 FROM policies p
//                 JOIN users u ON p.user_id = u.id
//                 WHERE p.status = 'active' 
//                   AND p.payment_status = 'paid'
//                   AND p.contract_address IS NOT NULL
//                 ORDER BY p.departure_date DESC
//             `);
            
//             const newContracts = new Map();
            
//             for (const policy of result.rows) {
//                 let risksArray = [];
//                 try {
//                     if (typeof policy.selected_risks === 'string') {
//                         if (policy.selected_risks.startsWith('[')) {
//                             risksArray = JSON.parse(policy.selected_risks);
//                         } else {
//                             risksArray = policy.selected_risks.split(',').map(r => r.trim());
//                         }
//                     } else if (Array.isArray(policy.selected_risks)) {
//                         risksArray = policy.selected_risks;
//                     }
//                 } catch(e) {
//                     risksArray = [];
//                 }
                
//                 const departureDateTime = this.parseDepartureDateTime(policy.departure_date, policy.departure_time);
                
//                 newContracts.set(policy.id, {
//                     policyId: policy.id,
//                     policyNumber: policy.policy_number,
//                     flightNumber: policy.flight_number,
//                     departureDate: policy.departure_date,
//                     departureTime: policy.departure_time,
//                     departureDateTime: departureDateTime,
//                     selectedRisks: risksArray,
//                     userEmail: policy.email,
//                     userName: policy.full_name,
//                     userId: policy.user_id,
//                     contractAddress: policy.contract_address,
//                     notificationSent: false,
//                     completed: policy.oracle_completed || false
//                 });
//             }
            
//             const oldSize = this.contracts.size;
//             this.contracts = newContracts;
//             const newSize = this.contracts.size;
            
//             console.log(`📋 Загружено активных полисов: ${newSize}`);
            
//             if (oldSize !== newSize) {
//                 console.log(`   🔄 Изменение: было ${oldSize}, стало ${newSize}`);
//             }
            
//             if (newSize === 0) {
//                 console.log('   (Нет активных полисов)');
//             } else {
//                 for (const [id, data] of this.contracts) {
//                     const departureStr = data.departureDateTime ? 
//                         data.departureDateTime.toLocaleString() : `${data.departureDate} ${data.departureTime}`;
//                     console.log(`   - ${data.policyNumber}: рейс ${data.flightNumber}, вылет: ${departureStr}, контракт: ${data.contractAddress || 'нет'}, завершён: ${data.completed}`);
//                 }
//             }
            
//         } catch (error) {
//             console.error('❌ Ошибка загрузки контрактов:', error.message);
//         }
//     }
    
//     async reloadActiveContracts() {
//         try {
//             const result = await this.pool.query(`
//                 SELECT p.id, p.policy_number, p.flight_number, p.departure_date,
//                        p.departure_time, p.selected_risks, p.contract_address,
//                        p.oracle_completed,
//                        u.email, u.full_name, u.id as user_id
//                 FROM policies p
//                 JOIN users u ON p.user_id = u.id
//                 WHERE p.status = 'active' 
//                   AND p.payment_status = 'paid'
//                   AND p.contract_address IS NOT NULL
//                 ORDER BY p.departure_date DESC
//             `);
            
//             const newContracts = new Map();
//             const newPolicyIds = [];
            
//             for (const policy of result.rows) {
//                 let risksArray = [];
//                 try {
//                     if (typeof policy.selected_risks === 'string') {
//                         if (policy.selected_risks.startsWith('[')) {
//                             risksArray = JSON.parse(policy.selected_risks);
//                         } else {
//                             risksArray = policy.selected_risks.split(',').map(r => r.trim());
//                         }
//                     } else if (Array.isArray(policy.selected_risks)) {
//                         risksArray = policy.selected_risks;
//                     }
//                 } catch(e) {
//                     risksArray = [];
//                 }
                
//                 const departureDateTime = this.parseDepartureDateTime(policy.departure_date, policy.departure_time);
                
//                 // Сохраняем старые флаги, если полис уже был
//                 const oldData = this.contracts.get(policy.id);
//                 const notificationSent = oldData ? oldData.notificationSent : false;
//                 const completed = policy.oracle_completed || false;
                
//                 // Запоминаем новые ID
//                 if (!this.contracts.has(policy.id)) {
//                     newPolicyIds.push(policy.id);
//                 }
                
//                 newContracts.set(policy.id, {
//                     policyId: policy.id,
//                     policyNumber: policy.policy_number,
//                     flightNumber: policy.flight_number,
//                     departureDate: policy.departure_date,
//                     departureTime: policy.departure_time,
//                     departureDateTime: departureDateTime,
//                     selectedRisks: risksArray,
//                     userEmail: policy.email,
//                     userName: policy.full_name,
//                     userId: policy.user_id,
//                     contractAddress: policy.contract_address,
//                     notificationSent: notificationSent,
//                     completed: completed
//                 });
//             }
            
//             const oldSize = this.contracts.size;
//             this.contracts = newContracts;
//             const newSize = this.contracts.size;
            
//             if (oldSize !== newSize) {
//                 console.log(`🔄 Перезагрузка полисов: было ${oldSize}, стало ${newSize}`);
                
//                 for (const policyId of newPolicyIds) {
//                     const policyData = this.contracts.get(policyId);
//                     if (policyData && !policyData.completed) {
//                         console.log(`   ➕ Новый полис ${policyData.policyNumber}: немедленная проверка...`);
                        
//                         if (this.isDeparturePassed(policyData.departureDateTime)) {
//                             await this.checkFlight(policyId, policyData);
//                         } else {
//                             const departureStr = policyData.departureDateTime ? 
//                                 policyData.departureDateTime.toLocaleString() : `${policyData.departureDate} ${policyData.departureTime}`;
//                             console.log(`      ⏳ Ожидание вылета в ${departureStr}`);
//                         }
//                     }
//                 }
//             }
            
//         } catch (error) {
//             console.error('❌ Ошибка перезагрузки контрактов:', error.message);
//         }
//     }
    
//     startMonitoring(intervalMinutes = 5) {
//         console.log(`\n🔄 Запуск мониторинга RedStone (интервал: ${intervalMinutes} мин)`);
//         console.log(`   📌 Перезагрузка списка полисов каждые 60 секунд`);
//         console.log(`   📌 Уведомления отправляются ТОЛЬКО после времени вылета\n`);
        
//         this.monitoringInterval = setInterval(async () => {
//             await this.checkAllFlights();
//         }, intervalMinutes * 60 * 1000);
        
//         this.reloadInterval = setInterval(async () => {
//             await this.reloadActiveContracts();
//         }, 60000);
        
//         setTimeout(() => {
//             this.checkAllFlights();
//         }, 5000);
//     }
    
//     isDeparturePassed(departureDateTime) {
//         if (!departureDateTime) return true;
//         const now = new Date();
//         return now >= departureDateTime;
//     }
    
//     async checkAllFlights() {
//         console.log(`\n🔍 ${new Date().toLocaleString()} - RedStone проверка рейсов...`);
        
//         let checkedCount = 0;
//         let pendingCount = 0;
        
//         for (const [policyId, data] of this.contracts) {
//             // Пропускаем уже обработанные полисы
//             if (data.completed) continue;
            
//             if (!this.isDeparturePassed(data.departureDateTime)) {
//                 const departureStr = data.departureDateTime ? 
//                     data.departureDateTime.toLocaleString() : `${data.departureDate} ${data.departureTime}`;
//                 console.log(`\n✈️ Полис ${data.policyNumber}: рейс ${data.flightNumber} - ОЖИДАНИЕ (вылет в ${departureStr})`);
//                 pendingCount++;
//                 continue;
//             }
            
//             await this.checkFlight(policyId, data);
//             checkedCount++;
//             await new Promise(r => setTimeout(r, 1000));
//         }
        
//         console.log(`\n📊 Проверено рейсов: ${checkedCount}, ожидают вылета: ${pendingCount}`);
//     }
    
//     async checkFlight(policyId, flightData) {
//         console.log(`\n✈️ Полис ${flightData.policyNumber}: рейс ${flightData.flightNumber}`);
//         const departureStr = flightData.departureDateTime ? 
//             flightData.departureDateTime.toLocaleString() : `${flightData.departureDate} ${flightData.departureTime}`;
//         console.log(`   📅 Вылет: ${departureStr}`);
        
//         const aviationData = await this.getAviationStackData(flightData.flightNumber);
        
//         if (!aviationData) {
//             console.log(`   ⚠️ Нет данных от AviationStack`);
//             return;
//         }
        
//         console.log(`   📊 Статус: ${aviationData.status}, задержка: ${aviationData.delay} мин`);
        
//         const shouldPayout = this.checkConditions(flightData, aviationData);
        
//         // Уведомление о своевременном вылете
//         const isOnTime = (aviationData.status === 'scheduled' || aviationData.status === 'landed') && aviationData.delay < 15;
        
//         if (isOnTime && !flightData.notificationSent) {
//             console.log(`   ✅ РЕЙС ВОВРЕМЯ! Отправляем уведомление...`);
//             await this.createOnTimeNotification(flightData, aviationData);
            
//             // Обновляем флаги в БД и в памяти
//             await this.pool.query(`
//                 UPDATE policies 
//                 SET oracle_completed = TRUE 
//                 WHERE id = $1
//             `, [policyId]);
            
//             flightData.notificationSent = true;
//             flightData.completed = true;
//             this.contracts.set(policyId, flightData);
//         }
        
//         if (shouldPayout) {
//             console.log(`   💰 ВЫПЛАТА назначена!`);
//             await this.createPayoutNotification(flightData, aviationData);
            
//             if (flightData.contractAddress && flightData.contractAddress !== 'нет') {
//                 try {
//                     const riskType = this.getRiskType(aviationData.status, flightData.selectedRisks);
//                     const riskValue = aviationData.delay || 0;
                    
//                     await axios.post(`${TON_SERVICE_URL}http://localhost:3000/api/ton/payout`, {
//                         policyId: flightData.policyId,
//                         contractAddress: flightData.contractAddress,
//                         riskType: riskType,
//                         riskValue: riskValue
//                     });
//                     console.log(`   📡 Отправлена выплата в TON`);
//                 } catch (error) {
//                     console.error(`   ❌ TON ошибка:`, error.message);
//                 }
//             }
            
//             // Обновляем флаг в БД
//             await this.pool.query(`
//                 UPDATE policies 
//                 SET oracle_completed = TRUE 
//                 WHERE id = $1
//             `, [policyId]);
            
//             flightData.completed = true;
//             this.contracts.set(policyId, flightData);
//         }
        
//         const redstoneData = this.signRedStoneData(aviationData, flightData);
//         await this.saveOracleData(flightData.policyId, flightData.flightNumber, aviationData, redstoneData);
//     }
    
//     async createOnTimeNotification(flightData, aviationData) {
//         try {
//             await this.pool.query(
//                 `INSERT INTO notifications (user_id, policy_id, notification_type, title, message, amount_rub, risk_code)
//                  VALUES ($1, $2, 'info', '✅ Рейс вылетел вовремя!',
//                          $3, $4, $5)`,
//                 [
//                     flightData.userId,
//                     flightData.policyId,
//                     `Рейс ${flightData.flightNumber} вылетел по расписанию ${flightData.departureDate} в ${flightData.departureTime}. Задержка отсутствует.`,
//                     0,
//                     'ontime'
//                 ]
//             );
//             console.log(`   📧 Уведомление о своевременном вылете создано`);
//         } catch (error) {
//             console.error('   ❌ Ошибка создания уведомления:', error.message);
//         }
//     }
    
//     async createPayoutNotification(flightData, aviationData) {
//         const payoutAmount = 50000;
        
//         try {
//             await this.pool.query(
//                 `INSERT INTO notifications (user_id, policy_id, notification_type, title, message, amount_rub, risk_code)
//                  VALUES ($1, $2, 'payout', '💰 Выплата по страховому случаю!',
//                          $3, $4, $5)`,
//                 [
//                     flightData.userId,
//                     flightData.policyId,
//                     `RedStone Oracle: ${aviationData.status === 'delayed' ? `задержка рейса ${aviationData.delay} минут` : 'отмена рейса'} для полиса ${flightData.policyNumber}`,
//                     payoutAmount,
//                     aviationData.status === 'delayed' ? 'flight_delay' : 'flight_cancellation'
//                 ]
//             );
//             console.log(`   📧 Уведомление о выплате создано на сумму ${payoutAmount} ₽`);
//         } catch (error) {
//             console.error('   ❌ Ошибка создания уведомления:', error.message);
//         }
//     }
    
//     getRiskType(status, selectedRisks) {
//         if (status === 'delayed' && selectedRisks.includes('flight_delay')) {
//             return 1;
//         }
//         if (status === 'cancelled' && selectedRisks.includes('flight_cancellation')) {
//             return 2;
//         }
//         if (selectedRisks.includes('baggage_loss')) {
//             return 4;
//         }
//         return 1;
//     }
    
//     async getAviationStackData(flightNumber) {
//         const apiKey = process.env.AVIATIONSTACK_KEY;
        
//         if (!apiKey) {
//             return this.simulateData(flightNumber);
//         }
        
//         try {
//             const response = await axios.get('https:/http://localhost:3000/api.aviationstack.com/v1/flights', {
//                 params: {
//                     access_key: apiKey,
//                     flight_iata: flightNumber,
//                     limit: 1
//                 },
//                 timeout: 10000
//             });
            
//             if (response.data && response.data.data && response.data.data.length > 0) {
//                 const flight = response.data.data[0];
//                 return {
//                     flight: flight.flight?.iata,
//                     status: flight.flight_status || 'scheduled',
//                     delay: flight.departure?.delay || 0,
//                     airline: flight.airline?.name,
//                     source: 'aviationstack'
//                 };
//             }
//             return null;
//         } catch (error) {
//             console.error(`   ❌ AviationStack error:`, error.message);
//             return this.simulateData(flightNumber);
//         }
//     }
    
//     simulateData(flightNumber) {
//         const random = Math.random();
//         if (random < 0.7) {
//             return {
//                 flight: flightNumber,
//                 status: 'landed',
//                 delay: 0,
//                 source: 'simulation'
//             };
//         }
//         if (random < 0.82) {
//             return {
//                 flight: flightNumber,
//                 status: 'delayed',
//                 delay: Math.floor(Math.random() * 180) + 60,
//                 source: 'simulation'
//             };
//         }
//         if (random < 0.9) {
//             return {
//                 flight: flightNumber,
//                 status: 'cancelled',
//                 delay: 0,
//                 source: 'simulation'
//             };
//         }
//         return {
//             flight: flightNumber,
//             status: 'scheduled',
//             delay: 0,
//             source: 'simulation'
//         };
//     }
    
//     signRedStoneData(aviationData, flightData) {
//         const timestamp = Math.floor(Date.now() / 1000);
//         const dataPackage = {
//             flight: flightData.flightNumber,
//             status: aviationData.status,
//             delay: aviationData.delay,
//             timestamp: timestamp,
//             provider: aviationData.source || 'aviationstack',
//             confidence: aviationData.source === 'aviationstack' ? 95 : 70
//         };
        
//         const crypto = require('crypto');
//         const hash = crypto.createHash('sha256');
//         hash.update(JSON.stringify(dataPackage));
//         const signature = '0x' + hash.digest('hex').substring(0, 64);
        
//         return {
//             data: dataPackage,
//             signature: signature,
//             timestamp: timestamp
//         };
//     }
    
//     checkConditions(flightData, aviationData) {
//         if (!aviationData) return false;
        
//         const risks = flightData.selectedRisks;
        
//         if (aviationData.status === 'delayed' && risks.includes('flight_delay')) {
//             return aviationData.delay >= 120;
//         }
        
//         if (aviationData.status === 'cancelled' && risks.includes('flight_cancellation')) {
//             return true;
//         }
        
//         return false;
//     }
    
//     async saveOracleData(policyId, flightNumber, aviationData, redstoneData) {
//         try {
//             await this.pool.query(
//                 `INSERT INTO flight_monitoring (
//                     policy_id, flight_number, flight_status, delay_minutes,
//                     data_source, raw_response, processed
//                 ) VALUES ($1, $2, $3, $4, $5, $6, false)`,
//                 [
//                     policyId,
//                     flightNumber,
//                     aviationData.status,
//                     aviationData.delay,
//                     'aviationstack+redstone',
//                     JSON.stringify({ aviation: aviationData, redstone: redstoneData })
//                 ]
//             );
//         } catch (error) {
//             console.error('   ❌ Ошибка сохранения в БД:', error.message);
//         }
//     }
    
//     stopMonitoring() {
//         if (this.monitoringInterval) {
//             clearInterval(this.monitoringInterval);
//             this.monitoringInterval = null;
//         }
//         if (this.reloadInterval) {
//             clearInterval(this.reloadInterval);
//             this.reloadInterval = null;
//         }
//         console.log('\n🛑 RedStone Oracle остановлен');
//     }
// }

// const oracle = new RedStoneOracleServer();

// async function start() {
//     const connected = await oracle.init();
    
//     if (!connected) {
//         console.log('\n❌ Не удалось подключиться к базе данных');
//         process.exit(1);
//     }
    
//     app.post('http://localhost:3000/api/redstone/webhook', async (req, res) => {
//         console.log('📨 Webhook:', req.body);
//         res.json({ received: true });
//     });
    
//     app.get('http://localhost:3000/api/redstone/status', (req, res) => {
//         res.json({
//             status: 'running',
//             contracts: oracle.contracts.size,
//             timestamp: new Date().toISOString()
//         });
//     });
    
//     const PORT = process.env.REDSTONE_PORT || 3002;
//     app.listen(PORT, () => {
//         console.log(`\n📡 RedStone Oracle на порту ${PORT}`);
//         console.log(`   Webhook: http://localhost:${PORT}http://localhost:3000/api/redstone/webhook`);
//         console.log(`   Status: http://localhost:${PORT}http://localhost:3000/api/redstone/status`);
//     });
    
//     process.on('SIGINT', () => {
//         console.log('\n🛑 Остановка...');
//         oracle.stopMonitoring();
//         process.exit(0);
//     });
// }

// start().catch(console.error);





// oracle/redstone-server.js - RedStone Oracle сервер (ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
// С автоматической перезагрузкой полисов и правильной логикой проверки

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json());

// TON сервис
const TON_SERVICE_URL = process.env.TON_SERVICE_URL || 'http://localhost:3004';

class RedStoneOracleServer {
    constructor() {
        this.pool = null;
        this.monitoringInterval = null;
        this.reloadInterval = null;
        this.contracts = new Map();
    }
    
    async init() {
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            password: String(process.env.DB_PASSWORD || ''),
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'VKR'
        });
        
        try {
            const client = await this.pool.connect();
            console.log('✅ Подключено к PostgreSQL');
            client.release();
        } catch (err) {
            console.error('❌ Ошибка подключения к БД:', err.message);
            return false;
        }
        
        console.log('✅ RedStone Oracle Server инициализирован');
        
        await this.loadActiveContracts();
        this.startMonitoring();
        
        return true;
    }
    
    // Правильное формирование даты вылета
    parseDepartureDateTime(departureDate, departureTime) {
        if (!departureDate || !departureTime) return null;
        try {
            let year, month, day;
            
            if (departureDate instanceof Date) {
                year = departureDate.getFullYear();
                month = departureDate.getMonth() + 1;
                day = departureDate.getDate();
            } 
            else if (typeof departureDate === 'string') {
                let dateStr = departureDate;
                if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }
                if (dateStr.includes('-')) {
                    [year, month, day] = dateStr.split('-');
                } else {
                    throw new Error(`Неизвестный формат даты: ${departureDate}`);
                }
            } else {
                throw new Error(`Неизвестный тип даты: ${typeof departureDate}`);
            }
            
            const [hours, minutes, seconds] = departureTime.split(':');
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                  parseInt(hours), parseInt(minutes), parseInt(seconds || 0));
            return date;
        } catch (error) {
            console.error(`Ошибка парсинга даты: ${departureDate} ${departureTime}`, error.message);
            return null;
        }
    }
    
    async loadActiveContracts() {
        try {
            const result = await this.pool.query(`
                SELECT p.id, p.policy_number, p.flight_number, p.departure_date,
                       p.departure_time, p.selected_risks, p.contract_address,
                       p.oracle_completed, p.oracle_checked,
                       u.email, u.full_name, u.id as user_id
                FROM policies p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'active' 
                  AND p.payment_status = 'paid'
                  AND p.contract_address IS NOT NULL
                ORDER BY p.departure_date DESC
            `);
            
            const newContracts = new Map();
            
            for (const policy of result.rows) {
                let risksArray = [];
                try {
                    if (typeof policy.selected_risks === 'string') {
                        if (policy.selected_risks.startsWith('[')) {
                            risksArray = JSON.parse(policy.selected_risks);
                        } else {
                            risksArray = policy.selected_risks.split(',').map(r => r.trim());
                        }
                    } else if (Array.isArray(policy.selected_risks)) {
                        risksArray = policy.selected_risks;
                    }
                } catch(e) {
                    risksArray = [];
                }
                
                const departureDateTime = this.parseDepartureDateTime(policy.departure_date, policy.departure_time);
                
                newContracts.set(policy.id, {
                    policyId: policy.id,
                    policyNumber: policy.policy_number,
                    flightNumber: policy.flight_number,
                    departureDate: policy.departure_date,
                    departureTime: policy.departure_time,
                    departureDateTime: departureDateTime,
                    selectedRisks: risksArray,
                    userEmail: policy.email,
                    userName: policy.full_name,
                    userId: policy.user_id,
                    contractAddress: policy.contract_address,
                    notificationSent: false,
                    completed: policy.oracle_completed || false,
                    checked: policy.oracle_checked || false
                });
            }
            
            const oldSize = this.contracts.size;
            this.contracts = newContracts;
            const newSize = this.contracts.size;
            
            console.log(`📋 Загружено активных полисов: ${newSize}`);
            
            if (oldSize !== newSize) {
                console.log(`   🔄 Изменение: было ${oldSize}, стало ${newSize}`);
            }
            
            if (newSize === 0) {
                console.log('   (Нет активных полисов)');
            } else {
                for (const [id, data] of this.contracts) {
                    const departureStr = data.departureDateTime ? 
                        data.departureDateTime.toLocaleString() : `${data.departureDate} ${data.departureTime}`;
                    console.log(`   - ${data.policyNumber}: рейс ${data.flightNumber}, вылет: ${departureStr}, контракт: ${data.contractAddress || 'нет'}, завершён: ${data.completed}, проверен: ${data.checked}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрактов:', error.message);
        }
    }
    
    async reloadActiveContracts() {
        try {
            const result = await this.pool.query(`
                SELECT p.id, p.policy_number, p.flight_number, p.departure_date,
                       p.departure_time, p.selected_risks, p.contract_address,
                       p.oracle_completed, p.oracle_checked,
                       u.email, u.full_name, u.id as user_id
                FROM policies p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'active' 
                  AND p.payment_status = 'paid'
                  AND p.contract_address IS NOT NULL
                ORDER BY p.departure_date DESC
            `);
            
            const newContracts = new Map();
            const newPolicyIds = [];
            
            for (const policy of result.rows) {
                let risksArray = [];
                try {
                    if (typeof policy.selected_risks === 'string') {
                        if (policy.selected_risks.startsWith('[')) {
                            risksArray = JSON.parse(policy.selected_risks);
                        } else {
                            risksArray = policy.selected_risks.split(',').map(r => r.trim());
                        }
                    } else if (Array.isArray(policy.selected_risks)) {
                        risksArray = policy.selected_risks;
                    }
                } catch(e) {
                    risksArray = [];
                }
                
                const departureDateTime = this.parseDepartureDateTime(policy.departure_date, policy.departure_time);
                
                const oldData = this.contracts.get(policy.id);
                const notificationSent = oldData ? oldData.notificationSent : false;
                const completed = policy.oracle_completed || false;
                const checked = policy.oracle_checked || false;
                
                if (!this.contracts.has(policy.id)) {
                    newPolicyIds.push(policy.id);
                }
                
                newContracts.set(policy.id, {
                    policyId: policy.id,
                    policyNumber: policy.policy_number,
                    flightNumber: policy.flight_number,
                    departureDate: policy.departure_date,
                    departureTime: policy.departure_time,
                    departureDateTime: departureDateTime,
                    selectedRisks: risksArray,
                    userEmail: policy.email,
                    userName: policy.full_name,
                    userId: policy.user_id,
                    contractAddress: policy.contract_address,
                    notificationSent: notificationSent,
                    completed: completed,
                    checked: checked
                });
            }
            
            const oldSize = this.contracts.size;
            this.contracts = newContracts;
            const newSize = this.contracts.size;
            
            if (oldSize !== newSize) {
                console.log(`🔄 Перезагрузка полисов: было ${oldSize}, стало ${newSize}`);
                
                for (const policyId of newPolicyIds) {
                    const policyData = this.contracts.get(policyId);
                    if (policyData && !policyData.completed && !policyData.checked) {
                        console.log(`   ➕ Новый полис ${policyData.policyNumber}: немедленная проверка...`);
                        
                        if (this.isDeparturePassed(policyData.departureDateTime)) {
                            await this.checkFlight(policyId, policyData);
                        } else {
                            const departureStr = policyData.departureDateTime ? 
                                policyData.departureDateTime.toLocaleString() : `${policyData.departureDate} ${policyData.departureTime}`;
                            console.log(`      ⏳ Ожидание вылета в ${departureStr}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка перезагрузки контрактов:', error.message);
        }
    }
    
    startMonitoring(intervalMinutes = 5) {
        console.log(`\n🔄 Запуск мониторинга RedStone (интервал: ${intervalMinutes} мин)`);
        console.log(`   📌 Перезагрузка списка полисов каждые 60 секунд`);
        console.log(`   📌 Уведомления отправляются ТОЛЬКО после времени вылета\n`);
        
        this.monitoringInterval = setInterval(async () => {
            await this.checkAllFlights();
        }, intervalMinutes * 60 * 1000);
        
        this.reloadInterval = setInterval(async () => {
            await this.reloadActiveContracts();
        }, 60000);
        
        setTimeout(() => {
            this.checkAllFlights();
        }, 5000);
    }
    
    isDeparturePassed(departureDateTime) {
        if (!departureDateTime) return true;
        const now = new Date();
        return now >= departureDateTime;
    }
    
    async checkAllFlights() {
        console.log(`\n🔍 ${new Date().toLocaleString()} - RedStone проверка рейсов...`);
        
        let checkedCount = 0;
        let pendingCount = 0;
        
        for (const [policyId, data] of this.contracts) {
            // Пропускаем уже обработанные или уже проверенные полисы
            if (data.completed || data.checked) continue;
            
            if (!this.isDeparturePassed(data.departureDateTime)) {
                const departureStr = data.departureDateTime ? 
                    data.departureDateTime.toLocaleString() : `${data.departureDate} ${data.departureTime}`;
                console.log(`\n✈️ Полис ${data.policyNumber}: рейс ${data.flightNumber} - ОЖИДАНИЕ (вылет в ${departureStr})`);
                pendingCount++;
                continue;
            }
            
            await this.checkFlight(policyId, data);
            checkedCount++;
            await new Promise(r => setTimeout(r, 1000));
        }
        
        console.log(`\n📊 Проверено рейсов: ${checkedCount}, ожидают вылета: ${pendingCount}`);
    }
    
    async checkFlight(policyId, flightData) {
        console.log(`\n✈️ Полис ${flightData.policyNumber}: рейс ${flightData.flightNumber}`);
        const departureStr = flightData.departureDateTime ? 
            flightData.departureDateTime.toLocaleString() : `${flightData.departureDate} ${flightData.departureTime}`;
        console.log(`   📅 Вылет: ${departureStr}`);
        
        const aviationData = await this.getAviationStackData(flightData.flightNumber);
        
        if (!aviationData) {
            console.log(`   ⚠️ Нет данных от AviationStack, проверим позже`);
            return;
        }
        
        console.log(`   📊 Статус: ${aviationData.status}, задержка: ${aviationData.delay} мин`);
        
        const shouldPayout = this.checkConditions(flightData, aviationData);
        const isOnTime = (aviationData.status === 'scheduled' || aviationData.status === 'landed') && aviationData.delay < 15;
        const isMinorDelay = aviationData.status === 'delayed' && aviationData.delay > 0 && aviationData.delay < 120;
        const isAlternateAirport = aviationData.status === 'diverted' || aviationData.status === 'alternate_airport';
        
        // ========== ВЫПЛАТА ==========
        if (shouldPayout || isAlternateAirport) {
            console.log(`   💰 ВЫПЛАТА назначена!`);
            await this.createPayoutNotification(flightData, aviationData);
            
            if (flightData.contractAddress && flightData.contractAddress !== 'нет') {
                try {
                    const riskType = this.getRiskType(aviationData.status, flightData.selectedRisks, isAlternateAirport);
                    const riskValue = aviationData.delay || 0;
                    
                    await axios.post(`${TON_SERVICE_URL}http://localhost:3000/api/ton/payout`, {
                        policyId: flightData.policyId,
                        contractAddress: flightData.contractAddress,
                        riskType: riskType,
                        riskValue: riskValue
                    });
                    console.log(`   📡 Отправлена выплата в TON`);
                } catch (error) {
                    console.error(`   ❌ TON ошибка:`, error.message);
                }
            }
            
            await this.pool.query(`
                UPDATE policies 
                SET oracle_completed = TRUE,
                    oracle_checked = TRUE
                WHERE id = $1
            `, [policyId]);
            
            flightData.completed = true;
            flightData.checked = true;
            this.contracts.set(policyId, flightData);
            
            const redstoneData = this.signRedStoneData(aviationData, flightData);
            await this.saveOracleData(flightData.policyId, flightData.flightNumber, aviationData, redstoneData);
            return;
        }
        
        // ========== РЕЙС ВОВРЕМЯ ==========
        if (isOnTime) {
            if (!flightData.notificationSent) {
                console.log(`   ✅ РЕЙС ВОВРЕМЯ! Отправляем уведомление...`);
                await this.createOnTimeNotification(flightData, aviationData);
                flightData.notificationSent = true;
            }
            
            await this.pool.query(`
                UPDATE policies 
                SET oracle_completed = TRUE,
                    oracle_checked = TRUE
                WHERE id = $1
            `, [policyId]);
            
            flightData.completed = true;
            flightData.checked = true;
            this.contracts.set(policyId, flightData);
            
            const redstoneData = this.signRedStoneData(aviationData, flightData);
            await this.saveOracleData(flightData.policyId, flightData.flightNumber, aviationData, redstoneData);
            return;
        }
        
        // ========== НЕБОЛЬШАЯ ЗАДЕРЖКА ==========
        if (isMinorDelay) {
            console.log(`   ⏳ Небольшая задержка (${aviationData.delay} мин). Проверим позже...`);
            flightData.completed = false;
            flightData.checked = false;
            this.contracts.set(policyId, flightData);
            
            const redstoneData = this.signRedStoneData(aviationData, flightData);
            await this.saveOracleData(flightData.policyId, flightData.flightNumber, aviationData, redstoneData);
            return;
        }
        
        // ========== РЕЙС ВЫЛЕТЕЛ, НО УСЛОВИЙ НЕТ ==========
        console.log(`   ℹ️ Рейс вылетел, страховой случай не наступил. Завершаем мониторинг.`);
        
        await this.pool.query(`
            UPDATE policies 
            SET oracle_checked = TRUE,
                oracle_completed = TRUE
            WHERE id = $1
        `, [policyId]);
        
        flightData.completed = true;
        flightData.checked = true;
        this.contracts.set(policyId, flightData);
        
        const redstoneData = this.signRedStoneData(aviationData, flightData);
        await this.saveOracleData(flightData.policyId, flightData.flightNumber, aviationData, redstoneData);
    }
    
    getRiskType(status, selectedRisks, isAlternateAirport = false) {
        if (isAlternateAirport || status === 'diverted' || status === 'alternate_airport') {
            return 3;
        }
        if (status === 'delayed' && selectedRisks.includes('flight_delay')) {
            return 1;
        }
        if (status === 'cancelled' && selectedRisks.includes('flight_cancellation')) {
            return 2;
        }
        if (selectedRisks.includes('baggage_loss')) {
            return 4;
        }
        return 1;
    }
    
    async createOnTimeNotification(flightData, aviationData) {
        try {
            await this.pool.query(
                `INSERT INTO notifications (user_id, policy_id, notification_type, title, message, amount_rub, risk_code)
                 VALUES ($1, $2, 'info', '✅ Рейс вылетел вовремя!',
                         $3, $4, $5)`,
                [
                    flightData.userId,
                    flightData.policyId,
                    `Рейс ${flightData.flightNumber} вылетел по расписанию ${flightData.departureDate} в ${flightData.departureTime}. Задержка отсутствует.`,
                    0,
                    'ontime'
                ]
            );
            console.log(`   📧 Уведомление о своевременном вылете создано в БД`);
        } catch (error) {
            console.error('   ❌ Ошибка создания уведомления:', error.message);
        }
    }
    
    async createPayoutNotification(flightData, aviationData) {
        const payoutAmount = 50000;
        let riskCode = aviationData.status === 'delayed' ? 'flight_delay' : 
                       (aviationData.status === 'diverted' ? 'alternate_airport' : 'flight_cancellation');
        let message = `RedStone Oracle: `;
        
        if (aviationData.status === 'delayed') {
            message += `задержка рейса ${aviationData.delay} минут`;
        } else if (aviationData.status === 'diverted' || aviationData.status === 'alternate_airport') {
            message += `посадка на запасной аэродром`;
        } else {
            message += `отмена рейса`;
        }
        message += ` для полиса ${flightData.policyNumber}`;
        
        try {
            await this.pool.query(
                `INSERT INTO notifications (user_id, policy_id, notification_type, title, message, amount_rub, risk_code)
                 VALUES ($1, $2, 'payout', '💰 Выплата по страховому случаю!',
                         $3, $4, $5)`,
                [
                    flightData.userId,
                    flightData.policyId,
                    message,
                    payoutAmount,
                    riskCode
                ]
            );
            console.log(`   📧 Уведомление о выплате создано в БД на сумму ${payoutAmount} ₽`);
        } catch (error) {
            console.error('   ❌ Ошибка создания уведомления:', error.message);
        }
    }
    
    async getAviationStackData(flightNumber) {
        const apiKey = process.env.AVIATIONSTACK_KEY;
        
        if (!apiKey) {
            return this.simulateData(flightNumber);
        }
        
        try {
            const response = await axios.get('https:/http://localhost:3000/api.aviationstack.com/v1/flights', {
                params: {
                    access_key: apiKey,
                    flight_iata: flightNumber,
                    limit: 1
                },
                timeout: 10000
            });
            
            if (response.data && response.data.data && response.data.data.length > 0) {
                const flight = response.data.data[0];
                return {
                    flight: flight.flight?.iata,
                    status: flight.flight_status || 'scheduled',
                    delay: flight.departure?.delay || 0,
                    airline: flight.airline?.name,
                    source: 'aviationstack'
                };
            }
            return null;
        } catch (error) {
            console.error(`   ❌ AviationStack error:`, error.message);
            return this.simulateData(flightNumber);
        }
    }
    
    simulateData(flightNumber) {
        const random = Math.random();
        if (random < 0.7) {
            return {
                flight: flightNumber,
                status: 'landed',
                delay: 0,
                source: 'simulation'
            };
        }
        if (random < 0.82) {
            return {
                flight: flightNumber,
                status: 'delayed',
                delay: Math.floor(Math.random() * 180) + 60,
                source: 'simulation'
            };
        }
        if (random < 0.9) {
            return {
                flight: flightNumber,
                status: 'cancelled',
                delay: 0,
                source: 'simulation'
            };
        }
        if (random < 0.95) {
            return {
                flight: flightNumber,
                status: 'diverted',
                delay: 0,
                source: 'simulation'
            };
        }
        return {
            flight: flightNumber,
            status: 'scheduled',
            delay: 0,
            source: 'simulation'
        };
    }
    
    signRedStoneData(aviationData, flightData) {
        const timestamp = Math.floor(Date.now() / 1000);
        const dataPackage = {
            flight: flightData.flightNumber,
            status: aviationData.status,
            delay: aviationData.delay,
            timestamp: timestamp,
            provider: aviationData.source || 'aviationstack',
            confidence: aviationData.source === 'aviationstack' ? 95 : 70
        };
        
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(dataPackage));
        const signature = '0x' + hash.digest('hex').substring(0, 64);
        
        return {
            data: dataPackage,
            signature: signature,
            timestamp: timestamp
        };
    }
    
    checkConditions(flightData, aviationData) {
        if (!aviationData) return false;
        
        const risks = flightData.selectedRisks;
        
        // Запасной аэродром
        if (risks.includes('alternate_airport') && 
            (aviationData.status === 'diverted' || aviationData.status === 'alternate_airport')) {
            return true;
        }
        
        // Задержка рейса
        if (aviationData.status === 'delayed' && risks.includes('flight_delay')) {
            return aviationData.delay >= 120;
        }
        
        // Отмена рейса
        if (aviationData.status === 'cancelled' && risks.includes('flight_cancellation')) {
            return true;
        }
        
        return false;
    }
    
    async saveOracleData(policyId, flightNumber, aviationData, redstoneData) {
        try {
            await this.pool.query(
                `INSERT INTO flight_monitoring (
                    policy_id, flight_number, flight_status, delay_minutes,
                    data_source, raw_response, processed
                ) VALUES ($1, $2, $3, $4, $5, $6, false)`,
                [
                    policyId,
                    flightNumber,
                    aviationData.status,
                    aviationData.delay,
                    'aviationstack+redstone',
                    JSON.stringify({ aviation: aviationData, redstone: redstoneData })
                ]
            );
        } catch (error) {
            console.error('   ❌ Ошибка сохранения в БД:', error.message);
        }
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        if (this.reloadInterval) {
            clearInterval(this.reloadInterval);
            this.reloadInterval = null;
        }
        console.log('\n🛑 RedStone Oracle остановлен');
    }
}

const oracle = new RedStoneOracleServer();

async function start() {
    const connected = await oracle.init();
    
    if (!connected) {
        console.log('\n❌ Не удалось подключиться к базе данных');
        process.exit(1);
    }
    
    app.post('http://localhost:3000/api/redstone/webhook', async (req, res) => {
        console.log('📨 Webhook:', req.body);
        res.json({ received: true });
    });
    
    app.get('http://localhost:3000/api/redstone/status', (req, res) => {
        res.json({
            status: 'running',
            contracts: oracle.contracts.size,
            timestamp: new Date().toISOString()
        });
    });
    
    const PORT = process.env.REDSTONE_PORT || 3002;
    app.listen(PORT, () => {
        console.log(`\n📡 RedStone Oracle на порту ${PORT}`);
        console.log(`   Webhook: http://localhost:${PORT}http://localhost:3000/api/redstone/webhook`);
        console.log(`   Status: http://localhost:${PORT}http://localhost:3000/api/redstone/status`);
    });
    
    process.on('SIGINT', () => {
        console.log('\n🛑 Остановка...');
        oracle.stopMonitoring();
        process.exit(0);
    });
}

start().catch(console.error);