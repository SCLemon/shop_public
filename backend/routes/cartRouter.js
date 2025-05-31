const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db.js');



// 添加商品至購物車
router.post('/api/cart/add', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { product_uuid, quantity } = req.body;
    if (!token || !product_uuid) {
      return res.send({ type: 'error', msg: '請先登入後再加入購物車。', redirect:'/verify'});
    }
  
    let qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) qty = 1;
  
    try {
      // 1. 確認購物車是否存在，若無則新增
      const [cartRows] = await db.execute('SELECT token FROM Cart WHERE token = ?', [token]);
      if (cartRows.length === 0) {
        await db.execute('INSERT INTO Cart (token) VALUES (?)', [token]);
      }

      const trade_id = uuidv4();
      await db.execute(
        'INSERT INTO Cart_item (token, trade_id, product_uuid, quantity) VALUES (?, ?, ?, ?)',
        [token, trade_id, product_uuid, qty]
      );
  
      res.send({ type: 'success', msg: '商品已添加至購物車' });
    } 
    catch (error) {
      console.error(error);
      res.send({ type: 'error', msg: '系統異常錯誤，請洽客服人員。' });
    }
});

// 獲取購物車信息
router.get('/api/cart/items', async (req, res) => {
    const token = req.headers['x-user-token'];
    if (!token) {
      return res.send({ type: 'error', msg: '請先登入再查看購物車。' });
    }
  
    try {
      const [rows] = await db.execute(`
        SELECT
          ci.id,
          ci.trade_id,
          ci.product_uuid,
          ci.quantity,
          p.name,
          p.price,
          p.detail,
          p.src
        FROM Cart_Item ci
        JOIN Product p ON ci.product_uuid = p.uuid
        WHERE ci.token = ?
      `, [token]);
  
      res.json({
        type: 'success',
        data: rows
      });
    } catch (error) {
      console.error(error);
      res.send({ type: 'error', msg: '系統異常錯誤，請洽客服人員。' });
    }
});

// 更新購物車商品數量
router.put('/api/cart/update/quantity', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id, quantity } = req.body;

    // 檢查欄位
    if (!token || !trade_id || quantity === undefined) {
        return res.send({ type: 'error', msg: '商品數量更新失敗' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
        return res.send({ type: 'error', msg: '商品數量必須為數字且大於等於1' });
    }

    try {
        const [result] = await db.execute(`
            UPDATE Cart_Item
            SET quantity = ?
            WHERE token = ? AND trade_id = ?
        `, [qty, token, trade_id]);

        if (result.affectedRows === 0) {
            return res.send({ type: 'error', msg: '找不到對應的購物車項目' });
        }

        return res.send({ type: 'success', msg: '商品數量已更新' });
    } catch (err) {
        console.error('更新失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法更新商品數量' });
    }
});

// 刪除購物商品
router.delete('/api/cart/delete/:trade_id', async (req, res) => {
    const token = req.headers['x-user-token'];
    const { trade_id } = req.params;

    // 檢查欄位
    if (!token || !trade_id ) {
        return res.send({ type: 'error', msg: '商品刪除失敗' });
    }

    try {
        const [result] = await db.execute(`
            DELETE FROM Cart_Item
            WHERE token = ? AND trade_id = ?
        `, [token, trade_id]);

        if (result.affectedRows === 0) {
            return res.send({ type: 'error', msg: '找不到對應的購物車項目' });
        }

        return res.send({ type: 'success', msg: '商品刪除成功' });
    } catch (err) {
        console.error('更新失敗:', err);
        return res.send({ type: 'error', msg: '系統錯誤，無法刪除商品' });
    }
});

module.exports = router;