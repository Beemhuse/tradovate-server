Absolutely — here is a **clean, professional, production-ready `README.md`** for your entire WebSocket system, including:

* Binance → Cloudflare Worker proxy
* Live ticker streaming
* Live candlestick (kline) streaming
* WebSocket API events
* Backend architecture
* Frontend usage examples
* JWT-secured WebSocket connection

You can paste this directly into your repo.

---

# 📡 **Real-Time WebSocket Price Feed (README.md)**

> Live Crypto Market Data via Binance Streams → Cloudflare Worker → Node Backend → Frontend UI

---

# 🚀 Overview

This service provides **real-time cryptocurrency market data** using:

* **Binance WebSocket streams**
* **Cloudflare Worker proxy** to bypass regional DNS blocks
* **Node.js backend WebSocket processor**
* **Socket.IO broadcast layer** for authenticated clients
* **Ticker updates + candlestick (kline) updates**

The architecture ensures:

* Low latency
* High reliability (auto-reconnect)
* Works globally (including regions where Binance WS is blocked)

---

# 🏗 Architecture

```
Binance WebSocket Streams
        ↓ (Live market data)
Cloudflare Worker Proxy
        ↓ (Unblocks DNS / SSL)
Node Backend Feed (ws)
        ↓ (parses + emits updates)
Socket.IO WebSocket Server (secure)
        ↓
Frontend (React / Next.js / Mobile)
```

---

# 🌐 WebSocket Source (Cloudflare Proxy)

All Binance WebSocket traffic is routed through:

```
wss://<your-worker>.workers.dev/stream?streams=btcusdt@miniTicker
```

Example:

```
wss://nameless-leaf-1705.brightawah94.workers.dev/stream?streams=btcusdt@miniTicker
```

Supports multiple combined streams:

```
/stream?streams=btcusdt@miniTicker/ethusdt@kline_1m/xrpusdt@miniTicker
```

---

# 📊 Supported Streams

### **Ticker / miniTicker (live prices)**

Example:

```
btcusdt@miniTicker
ethusdt@miniTicker
xrpusdt@miniTicker
```

---

### **Kline / Candlestick (live charts)**

Example:

```
btcusdt@kline_1m
ethusdt@kline_5m
bchusdt@kline_1h
```

Streaming intervals:

```
1m, 5m, 15m, 30m, 1h, 4h, 1d
```

---

# 🧠 Backend Services

## 1️⃣ **Ticker Feed**

```ts
ws.on("message", (msg) => {
  const payload = JSON.parse(msg.toString());
  const data = payload.data;

  if (!data) return;

  const symbol = data.s.replace("USDT", "");
  const price = parseFloat(data.c);

  updatePrice(symbol, price);
});
```

Broadcasted to clients as:

```json
{
  "symbol": "BTC",
  "price": 29500.12
}
```

---

## 2️⃣ **Kline Feed**

```ts
const k = data.k;

updateKline({
  symbol: k.s.replace("USDT", ""),
  interval: k.i,
  open: parseFloat(k.o),
  high: parseFloat(k.h),
  low: parseFloat(k.l),
  close: parseFloat(k.c),
  volume: parseFloat(k.v),
  isClosed: k.x,
  timestamp: k.t
});
```

Broadcasted to frontend as:

```json
{
  "symbol": "BTC",
  "interval": "1m",
  "open": 30000.12,
  "high": 30120.00,
  "low": 29980.10,
  "close": 30040.55,
  "volume": 123.22,
  "isClosed": false,
  "timestamp": 1710020202000
}
```

---

# 🔐 WebSocket Authentication (Socket.IO)

All frontend WebSocket connections must include a valid JWT:

```js
const socket = io("https://your-api.com", {
  auth: { token: userToken }
});
```

Backend verification:

```ts
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  try {
    socket.data.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("INVALID_TOKEN"));
  }
});
```

---

# 📡 WebSocket Events

## **`prices:init`**

Sent immediately when user connects.

```json
{
  "BTC": { "price": 29500.12, "change24h": 2.1 },
  "ETH": { "price": 1800.50, "change24h": -0.5 }
}
```

---

## **`priceUpdate`**

Real-time price update.

```json
{
  "symbol": "BTC",
  "price": 29520.99
}
```

---

## **`klineUpdate`**

Real-time candle update.

```json
{
  "symbol": "BTC",
  "interval": "1m",
  "open": 30000,
  "high": 30120,
  "low": 29990,
  "close": 30050,
  "volume": 12.34,
  "isClosed": false,
  "timestamp": 1710020202000
}
```

---

# 🎨 Frontend Integration

## **1. Live Prices**

```js
socket.on("priceUpdate", (data) => {
  console.log("Live price:", data.symbol, data.price);
});
```

---

## **2. Live Klines**

```js
socket.on("klineUpdate", (data) => {
  // Update candlestick chart
  chart.update({
    time: data.timestamp / 1000,
    open: data.open,
    high: data.high,
    low: data.low,
    close: data.close
  });
});
```

---

## **3. Custom React Hook**

```tsx
export function useLiveTicker(symbol = "BTC") {
  const [price, setPrice] = useState(null);

  useEffect(() => {
    socket.on("priceUpdate", (data) => {
      if (data.symbol === symbol) setPrice(data.price);
    });

    return () => socket.off("priceUpdate");
  }, [symbol]);

  return price;
}
```

---

# 🔥 Auto-Reconnect Logic

Backend auto-reconnects WebSocket feed:

```ts
ws.on("close", () => {
  setTimeout(startBinanceFeed, 1500);
});
```

Frontend auto-reconnects Socket.IO automatically.

---


# 📦 Environment Variables

```
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

---

# 🧪 Testing

### Test connection manually:

```
wscat -c "wss://your-worker.workers.dev/stream?streams=btcusdt@miniTicker"
```

---

# 🏁 Conclusion

This WebSocket system provides:

✔ Real-time prices
✔ Real-time candlesticks
✔ Binance accuracy
✔ Region-unblocked Cloudflare Worker proxy
✔ JWT-secured WebSocket API
✔ Production-ready frontend hooks

---

