const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db.js');




// 獲取訂單 (使用者)
router.get('/api/finish/info', async (req, res) => {

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
        const statuses = ['已取消','已完成'];
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

// 獲取訂單 (管理員)
router.get('/api/finish/infoByManager', async (req, res) => {

    const token = req.headers['x-user-token'];
  
    if (!token) {
        return res.send({ type: 'error', msg: '請先登入再查看訂單。' });
    }
  
    try {
        // 1. 取得該用戶的所有訂單（Order）
        const [orders] = await db.execute(
            `SELECT * FROM \`Order\` ORDER BY created_at DESC`,
        );
        
        // 2. 對每筆訂單，查詢對應的訂單項目（Order_Item）與商品資訊（Product）
        const statuses = ['已取消','已完成'];
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
            [order.trade_id,, ...statuses]
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



module.exports = router;