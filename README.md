
# Development Architecture

## Put Resource
前端 build 完璧的資料請放在 dist 資料夾。
後端伺服器請放在 backend 資料夾。

# Generate SSL Certification (HTTPS Environment)
```
// 獲取免費 Domain Name
https://my.noip.com/

// 安裝 Let's Encrypt
sudo apt update
sudo apt install certbot

// 手動獲取憑證
sudo certbot certonly --standalone

// 自動更新憑證
sudo certbot renew --dry-run

```
# Modify SSL Certification Relative Path
```
You should modify path for these files in sslPath.js
```

## Deploy the Project
初始化前後端專案 npm i 完畢後：

```
sudo node http.js (For HTTP Environment)
sudo node https.js (For HTTPS Environment, SSL Requirement)
```

