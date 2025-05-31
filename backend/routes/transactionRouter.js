const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db.js');


// level 2 才可以進行操作
const authMiddleWare = async (req, res, next) => {
    try {
        const token = req.headers['x-user-token'];
        if (!token) {
            return res.send({
                type:'error',
                msg:'使用者身份異常'
            })
        }
        const [rows] = await db.query(`SELECT level FROM User WHERE token = ?`, [token]);
  
        if (rows.length === 0) {
            return res.send({
                type:'error',
                msg:'使用者身份異常'
            })
        }
  
        const user = rows[0];
  
        if (user.level !== 2) {
            return res.send({
                type:'error',
                msg:'使用者權限不足'
            })
        }
  
        next();
  
    } catch (err) {
        console.error('authMiddleWare 錯誤:', err);
        return res.send({
            type:'error',
            msg:'系統異常錯誤，請洽客服人員。'
        })
    }
};

// 立即下單
router.post('/api/transaction/add', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id, product_uuid } = req.body;
  
    if (!token || !trade_id || !product_uuid) {
        return res.send({ type: 'error', msg: '缺少必要參數'});
    }
  
    try {
        // 1. 查商品價格和數量
        const [productRows] = await db.execute(
            'SELECT price, remaining FROM Product WHERE uuid = ?',
            [product_uuid]
        );
        if (productRows.length === 0) {
            return res.send({ type: 'error', msg: '商品不存在'});
        }
        const price = productRows[0].price;


        // 2. 查購物車數量
        const [cartRows] = await db.execute(
            'SELECT quantity FROM Cart_Item WHERE trade_id = ? AND token = ?',
            [trade_id, token]
        );
        if (cartRows.length === 0) {
            return res.send({ type: 'error', msg: '購物車查無此商品。'});
        }
        const quantity = cartRows[0].quantity;
    

        // 3. 檢查下單數量是否超過剩餘數量
        const remaining =  productRows[0].remaining;
        if(quantity > remaining){
            return res.send({ type: 'error', msg: `商品剩餘數量不足（<${remaining}）。`});
        }

        // 更新商品剩餘數量
        await db.execute(
            'UPDATE Product SET remaining = remaining - ? WHERE uuid = ?',
            [quantity, product_uuid]
        );

        // 4. 計算訂單金額
        const total_amount = price * quantity;
    
        // 5. 新增訂單 (狀態未付款)
        await db.execute(
            'INSERT INTO `Order` (token, trade_id, total_amount, status) VALUES (?, ?, ?, "未付款")',
            [token, trade_id, total_amount]
        );

        // 6. 新增訂單商品項目
        await db.execute(
            `INSERT INTO Order_Item (trade_id, token, product_uuid, quantity, item_price) 
            VALUES (?, ?, ?, ?, ?)`,
            [trade_id, token, product_uuid, quantity, price]
        );
        
        // 7. 刪除購物車中該商品
        await db.execute(
            'DELETE FROM Cart_Item WHERE trade_id = ? AND token = ?',
            [trade_id, token]
        );

        res.send({ type: 'success', msg: '商品下單成功' });
    } catch (error) {
        console.error(error);
        res.send({ type: 'error', msg: '商品下單失敗' });
    }
});


// 獲取訂單(用戶)
router.get('/api/transaction/info', async (req, res) => {

    const token = req.headers['x-user-token'];
  
    if (!token) {
        return res.send({ type: 'error', msg: '請先登入再查看訂單。' });
    }
  
    try {
        // 1. 取得該用戶的所有訂單（Order）
        const [orders] = await db.execute(
            `SELECT * FROM \`Order\` WHERE token = ? ORDER BY created_at DESC`,
            [token]
        );
        
        // 2. 對每筆訂單，查詢對應的訂單項目（Order_Item）與商品資訊（Product）
        const statuses = ['未付款','確認中','已付款','已發貨'];
        const placeholders = statuses.map(() => '?').join(',');

        const results = [];

        for (let order of orders) {
        const [items] = await db.execute(
            `SELECT 
                OI.quantity,
                P.name AS product_name,
                P.detail AS product_detail,
                P.src AS product_image,
                P.uuid AS product_uuid
                FROM Order_Item OI
                JOIN Product P ON OI.product_uuid = P.uuid
                JOIN \`Order\` O ON O.trade_id = OI.trade_id AND O.token = OI.token
                WHERE OI.trade_id = ? AND OI.token = ? AND O.status IN (${placeholders})`,
            [order.trade_id, token, ...statuses]
        );

        for (let item of items) {
            results.push({
                order_id: order.id,
                token: order.token,
                trade_id: order.trade_id,
                total_amount: order.total_amount,
                status: order.status,
                created_at: order.created_at,
                quantity: item.quantity,
                product_name: item.product_name,
                product_detail: item.product_detail,
                product_image: item.product_image,
                product_uuid: item.product_uuid
            });
        }
    }

    res.send({ type: 'success', data: results });

    } catch (err) {
      console.error(err);
      res.send({ type: 'error', msg: '伺服器錯誤，無法獲取訂單。' });
    }
});

// 獲取訂單(管理員)
router.get('/api/transaction/infoByManager', authMiddleWare, async (req, res) => {

    const token = req.headers['x-user-token'];
  
    if (!token) {
        return res.send({ type: 'error', msg: '請先登入再查看訂單。' });
    }
  
    try {
        // 1. 取得所有訂單（Order）
        const [orders] = await db.execute(`SELECT * FROM \`Order\` ORDER BY created_at DESC` );
        
        // 2. 對每筆訂單，查詢對應的訂單項目（Order_Item）與商品資訊（Product）
        const statuses = ['未付款','確認中','已付款','已發貨'];
        const placeholders = statuses.map(() => '?').join(',');

        const results = [];

        for (let order of orders) {
            const [items] = await db.execute(
                `SELECT 
                    OI.quantity,
                    P.name AS product_name,
                    P.detail AS product_detail,
                    P.src AS product_image,
                    P.uuid AS product_uuid
                    FROM Order_Item OI
                    JOIN Product P ON OI.product_uuid = P.uuid
                    JOIN \`Order\` O ON O.trade_id = OI.trade_id
                    WHERE OI.trade_id = ? AND O.status IN (${placeholders})`,
            [order.trade_id, ...statuses]
            );

            for (let item of items) {
                results.push({
                    order_id: order.id,
                    token: order.token,
                    trade_id: order.trade_id,
                    total_amount: order.total_amount,
                    status: order.status,
                    created_at: order.created_at,
                    quantity: item.quantity,
                    product_name: item.product_name,
                    product_detail: item.product_detail,
                    product_image: item.product_image,
                    product_uuid: item.product_uuid
                });
            }
        }

        res.send({ type: 'success', data: results });
    } catch (err) {
      console.error(err);
      res.send({ type: 'error', msg: '伺服器錯誤，無法獲取訂單。' });
    }
});

// 取消訂單
router.delete('/api/transaction/delete/:trade_id', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.params;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '訂單取消失敗' });
    }

    // 先獲得 Order_item 中的 quantity, product_uuid
    const [items] = await db.execute(`SELECT product_uuid, quantity FROM Order_Item WHERE token = ? AND trade_id = ?`, [token, trade_id]);

    if (items.length === 0) {
        return res.send({ type: 'error', msg: '找不到對應的訂單項目' });
    }

    const {product_uuid , quantity} = items[0];


    try {
        
        // 更新訂單狀態
        await updateStatus(trade_id, '已取消');

        // 回補 product 的數量
        await db.execute(`UPDATE Product SET remaining = remaining + ? WHERE uuid = ?`, [quantity,product_uuid]);

        return res.send({ type: 'success', msg: '訂單取消成功' });
    } catch (err) {
        console.error('更新失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法取消訂單' });
    }
});

// 訂單付款
router.put('/api/transaction/pay', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.body;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '訂單付款失敗' });
    }

    try {
        
        // 更新訂單狀態
        await updateStatus(trade_id, '確認中');

        return res.send({ type: 'success', msg: '付款請求提交成功' });
    } catch (err) {
        console.error('付款失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法進行付款請求' });
    }
});

// 訂單付款確認（管理員）
router.put('/api/transaction/check',authMiddleWare, async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.body;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '訂單確認失敗' });
    }

    try {
        // 更新訂單狀態
        await updateStatus(trade_id, '已付款');

        return res.send({ type: 'success', msg: '付款確認成功' });
    } catch (err) {
        console.error('付款確認失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法進行付款確認' });
    }
});

// 訂單發貨（管理員）
router.put('/api/transaction/shipping',authMiddleWare, async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.body;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '訂單發貨失敗' });
    }

    try {
        // 更新訂單狀態
        await updateStatus(trade_id, '已發貨');

        return res.send({ type: 'success', msg: '執行發貨成功' });
    } catch (err) {
        console.error('執行發貨失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法進行發貨' });
    }
});

// 完成訂單
router.put('/api/transaction/finish', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.body;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '訂單完成失敗' });
    }

    try {
        await updateStatus(trade_id, '已完成');

        return res.send({ type: 'success', msg: '訂單完成' });
    } catch (err) {
        console.error('訂單完成失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法進行訂單完成' });
    }
});

async function updateStatus(trade_id, status){
    await db.execute(
        `UPDATE \`Order\` SET status = ? WHERE trade_id = ?`,
        [status, trade_id]
    );
}

module.exports = router;