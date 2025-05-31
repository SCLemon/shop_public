const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db.js');
const multer = require('multer');
const path = require('path')
const fs = require('fs')

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


// product 表中建立商品（uuid, name, detail, price, remaining, src(json))
const upload = multer();
router.post('/api/product/add', upload.fields([{ name: 'attachments' }]), authMiddleWare, async (req, res) => {
    
    // 商品識別碼
    const idx = uuidv4();
    const { name, price, detail, remaining } = req.body;
  
    // 驗證欄位
    if (!name || !price || !detail || !remaining) {
      return res.send({ type: 'error', msg: '缺少必要欄位' });
    }
  
    const attachments = req.files['attachments'] || [];
    const src = [];
  
    // 儲存圖片到 ../uploadDB 並建立 UUID 對應
    for (const file of attachments) {
      const fileUUID = uuidv4();
      let mimeType = (file.originalname).split('.')[(file.originalname).split('.').length - 1]
      const savePath = path.join(__dirname, '../uploadDB', `${fileUUID}.${mimeType}`);
  
      try {
        fs.writeFileSync(savePath, file.buffer);
        src.push(`${fileUUID}.${mimeType}`);
      } 
      catch (err) {
        console.error('儲存圖片失敗:', err);
        return res.send({ type: 'error', msg: '新增商品失敗' });
      }
    }
  
    try {
      // 寫入資料庫
      await db.execute(`INSERT INTO Product (uuid, name, detail, price, remaining, src) VALUES (?, ?, ?, ?, ?, ?)`, [idx, name, detail, price, remaining, JSON.stringify(src)]);
  
      return res.send({ type: 'success', msg: '商品新增成功' });
    } 
    catch (error) {
      console.error('寫入資料庫失敗:', error);
      return res.send({ type: 'error', msg: '新增商品失敗' });
    }
});

// 獲取資料
router.get('/api/product/get',async(req,res)=>{
  try {
    const [rows] = await db.execute('SELECT * FROM Product ORDER BY id DESC');
    res.send({
      type: 'success',
      data: rows
    });
  } 
  catch (error) {
    console.error('取得商品資料失敗:', error);
    res.send({
      type: 'error',
      msg: '無法取得商品資料'
    });
  }
})

// 下載圖片
router.get('/api/img/download/:filename',(req,res)=>{
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, '../uploadDB', filename);
  if (!fs.existsSync(imagePath)) {
    return res.status(404).send('圖片不存在');
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  const readStream = fs.createReadStream(imagePath);
  readStream.pipe(res);

})

// 刪除商品
router.delete('/api/product/remove/:uuid', authMiddleWare, async(req,res)=>{

  const { uuid } = req.params;

  try {

    const [rows] = await db.execute('SELECT src FROM Product WHERE uuid = ?', [uuid]);

    if (rows.length === 0) {
      return res.send({ type: 'error', msg: '商品刪除失敗' });
    }

    const srcArray = rows[0].src;

    for (const url of srcArray) {
      const filename = url;
      const filePath = path.join(__dirname, '../uploadDB',filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.execute(
      `UPDATE \`Order\` SET status = ? WHERE trade_id IN ( SELECT trade_id FROM Order_Item WHERE product_uuid = ?)`,
      ['已下架', uuid]
    );
    
    await db.execute('DELETE FROM Product WHERE uuid = ?', [uuid]);


    return res.send({ type: 'success', msg: '商品刪除成功' });
  }
  catch(e){
    console.error('刪除商品時發生錯誤:', e);
    return res.send({ type: 'error', msg: '系統異常錯誤，請洽客服人員。' });
  }
})

// 更新商品
router.put('/api/product/revise/:uuid', upload.fields([{ name: 'attachments' }]), authMiddleWare, async (req, res) => {
  const uuid = req.params.uuid;
  const { name, price, detail, remaining } = req.body;
  const attachments = req.files['attachments'] || [];

  try {
    // 查詢原有商品資料
    const [rows] = await db.execute('SELECT * FROM Product WHERE uuid = ?', [uuid]);
    if (rows.length === 0) {
      return res.send({ type: 'error', msg: '找不到該商品' });
    }

    const oldImages = rows[0].src

    if(attachments.length){
      // 刪除舊圖片（從 ../uploadDB）
      for (const filename of oldImages) {
        const filePath = path.join(__dirname, '../uploadDB', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      // 儲存新圖片
      const newSrc = [];
      for (const file of attachments) {
        const fileUUID = uuidv4();
        let mimeType = (file.originalname).split('.')[(file.originalname).split('.').length - 1]
        const savePath = path.join(__dirname, '../uploadDB', `${fileUUID}.${mimeType}`);
    
        try {
          fs.writeFileSync(savePath, file.buffer);
          newSrc.push(`${fileUUID}.${mimeType}`);
        } 
        catch (err) {
          console.error('儲存圖片失敗:', err);
          return res.send({ type: 'error', msg: '新增商品失敗' });
        }
      }

      // 更新資料庫內容
      await db.execute(
        'UPDATE Product SET name = ?, detail = ?, price = ?, remaining = ?, src = ? WHERE uuid = ?',
        [name, detail, price, remaining, JSON.stringify(newSrc), uuid]
      );
    }
    else {
      await db.execute(
        'UPDATE Product SET name = ?, detail = ?, price = ?, remaining = ? WHERE uuid = ?',
        [name, detail, price, remaining, uuid]
      );
    }

    return res.send({ type: 'success', msg: '商品更新成功' });
  } catch (err) {
    console.error('商品更新錯誤:', err);
    return res.send({ type: 'error', msg: '商品更新失敗' });
  }
});
module.exports = router;
