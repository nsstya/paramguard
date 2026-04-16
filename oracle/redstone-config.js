// oracle/redstone-config.js - Настройка RedStone Oracle
require('dotenv').config();

const redstoneConfig = {
    // RedStone API endpoints
    apiUrl: 'https:/http://localhost:3000/api.redstone.finance',
    dataFeedsUrl: 'https:/http://localhost:3000/api.redstone.finance/data-feeds',
    
    // Данные для подписи
    privateKey: process.env.REDSTONE_PRIVATE_KEY || '0x123...',
    
    // Источники данных
    sources: {
        flights: {
            provider: 'aviationstack',
            apiKey: process.env.AVIATIONSTACK_KEY,
            url: 'http:/http://localhost:3000/api.aviationstack.com/v1/flights'
        }
    },
    
    // Адреса смарт-контрактов в TON
    contracts: new Map()
};

module.exports = { redstoneConfig };