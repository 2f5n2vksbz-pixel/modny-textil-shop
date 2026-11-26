const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "30kb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

app.get("/health", (_req, res) => res.json({ ok: true, service: "modny-textil-shop" }));

app.post("/api/order", async (req, res) => {
  if (!BOT_TOKEN || !MANAGER_CHAT_ID) {
    return res.status(503).json({ error: "Магазин ещё не настроен: не заданы секреты Telegram на сервере." });
  }

  const { customer, phone, address, comment = "", items } = req.body || {};
  if (
    typeof customer !== "string" || !customer.trim() ||
    typeof phone !== "string" || !phone.trim() ||
    typeof address !== "string" || !address.trim() ||
    !Array.isArray(items) || items.length === 0 || items.length > 30
  ) {
    return res.status(400).json({ error: "Проверьте имя, телефон, адрес и состав корзины." });
  }

  const clean = (s, max = 500) => String(s).replace(/[<>]/g, "").trim().slice(0, max);
  const lines = [
    "🛍 НОВЫЙ ЗАКАЗ — МОДНЫЙ ТЕКСТИЛЬ",
    "",
    ...items.map((item) => {
      const name = clean(item.name, 120);
      const quantity = Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1));
      return `• ${name} — ${quantity} шт.`;
    }),
    "",
    `👤 Имя: ${clean(customer, 120)}`,
    `📞 Телефон: ${clean(phone, 80)}`,
    `📍 Адрес: ${clean(address, 500)}`,
    `💬 Комментарий: ${clean(comment, 700) || "—"}`,
    "",
    "Магазин: ООО «Модный Текстиль»"
  ];

  try {
    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: MANAGER_CHAT_ID,
        text: lines.join("\n"),
        disable_web_page_preview: true
      })
    });
    const data = await tg.json();
    if (!tg.ok || !data.ok) {
      console.error("Telegram sendMessage failed:", data.description || tg.status);
      return res.status(502).json({ error: "Telegram не принял заказ. Проверьте настройки бота и менеджера." });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Order delivery error:", error.message);
    return res.status(502).json({ error: "Ошибка соединения с Telegram." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`Modny Textil shop listening on ${PORT}`));
