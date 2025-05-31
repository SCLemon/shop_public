const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 443;

// 加载 SSL 憑證
const {keyForHttps , pemForHttps} = require('./sslPath.js')
const options = {
  key: fs.readFileSync(path.resolve(__dirname, keyForHttps)),
  cert: fs.readFileSync(path.resolve(__dirname, pemForHttps))
};

app.use('/api/', createProxyMiddleware({
  target: 'http://127.0.0.1:3007/api/',
  changeOrigin:true
}));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS Server is running on https://127.0.0.1:${PORT}`);
});
