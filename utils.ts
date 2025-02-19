import axios from "axios";

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const sendTelegramMessage = async (message: string) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw Error("Bot token or chat ID not defined.");
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: "html",
  });
};

export const sendTelegramMessageWithImage = async (
  message: string,
  imagePath: string
) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw Error("Bot token or chat ID not defined.");
  }
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  await axios.post(url, {
    chat_id: chatId,
    photo: imagePath,
    caption: message,
    parse_mode: "html",
  });
};
