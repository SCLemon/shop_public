use shop;
CREATE TABLE `Order_Item` (
  id INT AUTO_INCREMENT PRIMARY KEY,               -- 項目 ID
  trade_id VARCHAR(50) NOT NULL,                   -- 所屬訂單（對應 Order 表）
  token VARCHAR(50) NOT NULL,                      -- 使用者 ID（對應 Order 表）
  product_uuid VARCHAR(50) NOT NULL,               -- 商品 UUID（對應 Product 表）
  quantity INT NOT NULL,                           -- 購買數量
  item_price INT NOT NULL,                         -- 單項商品下單時的價格
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 建立時間

  FOREIGN KEY (trade_id) REFERENCES `Order`(trade_id) ON DELETE CASCADE,
  FOREIGN KEY (token) REFERENCES `Order`(token) ON DELETE CASCADE,
  FOREIGN KEY (product_uuid) REFERENCES Product(uuid) ON DELETE CASCADE
);
