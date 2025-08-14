'use strict';

module.exports = function (app) {

  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  const crypto = require('crypto');
  const stocksDB = {};

  function anonymizeIP(ip) {
    // Hash the IP for privacy
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  async function getStockData(stock) {
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      stock: data.symbol,
      price: Number(data.latestPrice)
    };
  }

  app.route('/api/stock-prices')
    .get(async function (req, res){
      let { stock, like } = req.query;
      if (!stock) return res.json({ error: 'No stock provided' });
      const ip = anonymizeIP(req.ip);
      like = like === 'true';

      if (Array.isArray(stock)) {
        // Compare two stocks
        const [stock1, stock2] = stock;
        const [data1, data2] = await Promise.all([getStockData(stock1), getStockData(stock2)]);
        if (!data1 || !data2) return res.json({ error: 'Invalid stock symbol' });

        // Likes logic
        stocksDB[data1.stock] = stocksDB[data1.stock] || { likes: new Set() };
        stocksDB[data2.stock] = stocksDB[data2.stock] || { likes: new Set() };
        if (like) {
          stocksDB[data1.stock].likes.add(ip);
          stocksDB[data2.stock].likes.add(ip);
        }
        const likes1 = stocksDB[data1.stock].likes.size;
        const likes2 = stocksDB[data2.stock].likes.size;
        return res.json({
          stockData: [
            { stock: data1.stock, price: data1.price, rel_likes: likes1 - likes2 },
            { stock: data2.stock, price: data2.price, rel_likes: likes2 - likes1 }
          ]
        });
      } else {
        // Single stock
        const data = await getStockData(stock);
        if (!data) return res.json({ error: 'Invalid stock symbol' });
        stocksDB[data.stock] = stocksDB[data.stock] || { likes: new Set() };
        if (like) stocksDB[data.stock].likes.add(ip);
        return res.json({
          stockData: {
            stock: data.stock,
            price: data.price,
            likes: stocksDB[data.stock].likes.size
          }
        });
      }
    });
    
};
