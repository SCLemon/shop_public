const express = require('express');
const compression = require('compression');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.set('trust proxy', 'loopback, 192.168.0.1'); 

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 分鐘
    max: 300, // 限制每個 IP 最多 100 次請求
    message: 'Too many requests from this IP, please try again after a minute.',
});

app.use(limiter);

// 資料庫處理
const pool = require('./db/db.js');
process.on('SIGINT', async function() {

    console.log('\n正在關閉伺服器與資料庫連線池...');
    try {
        await pool.end();
        console.log('連線池已關閉');
    } catch (err) {
        console.error('關閉連線池失敗：', err.message);
    } finally {
        process.exit(0);
    }
});

// verify router
const verifyRouter = require('./routes/verifyRouter');
app.use(verifyRouter);

// product router
const productRouter = require('./routes/productRouter');
app.use(productRouter);

// cart router
const cartRouter = require('./routes/cartRouter');
app.use(cartRouter);

// transaction router
const transactionRouter = require('./routes/transactionRouter');
app.use(transactionRouter);

// finish router
const finishRouter = require('./routes/finishRouter');
app.use(finishRouter);

app.listen(3007,()=>{
    console.log('server is running on port 3007')
})

// 避免系統中斷
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});