import axios from "axios";
import { AttachmentBuilder, EmbedBuilder, WebhookClient } from "discord.js";
import FormData from "form-data";
import fs from "fs";
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendTelegramMessage = async (message) => {
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

export const sendTelegramMessageWithImage = async (message, imagePath) => {
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
export const sendTelegramLocalImage = async (message, imagePath) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    throw new Error("Bot token o chat ID no definidos.");
  }
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", message);
  formData.append("parse_mode", "html");
  formData.append("photo", fs.createReadStream(imagePath));
  try {
    await axios.post(url, formData);
  } catch (error) {
    console.error("Error sending image", error);
  }
};
export const sendDiscordMessage = async (title, message, color = 0x8a2be2) => {
  try {
    const webhookClient = new WebhookClient({
      url: process.env.DISCORD_WEBHOOK_URL || "",
    });

    if (!webhookClient) {
      throw Error("Webhook client not defined.");
    }
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(message);

    webhookClient.send({
      username: "OhMyBounty",
      avatarURL: "https://i.imgur.com/8uE8voU.jpeg",
      embeds: [embed],
    });
  } catch (e) {
    console.log(e);
  }
};

export const sendDiscordReport = async (engagement, report) => {
  try {
    const webhookClient = new WebhookClient({
      url: process.env.DISCORD_WEBHOOK_URL || "",
    });

    const bugcrowdColors = [
      null, // Índice 0 (no se usa)
      0xff0000, // P1 - Red
      0xff8000, // P2 - Orange
      0xffff00, // P3 - Yellow
      0x00ff00, // P4 - Green
      0x0000ff, // P5 - Blue
    ];

    const embed = new EmbedBuilder()
      .setTitle(`🚨 New report in ${engagement.name} 🚨`)
      .setURL(`https://bugcrowd.com${report.engagement_path}`)
      .setColor(bugcrowdColors[report.priority])
      .setDescription(
        `**${report.title || "~~Redacted~~"}**\n\n` +
          `• **Priority:** ${report.priority}\n` +
          `• **Created:** ${new Date(report.created_at).toLocaleString()}\n` +
          `• **Disclosed:** ${report.disclosed || report.accepted_at}\n` +
          `• **Bounty:** ${report.amount || 0} $\n` +
          `• **Points:** ${report.points || 0}\n` +
          `• **Status:** ${report.substate}\n` +
          `• **Researcher:** ${
            report.researcher_username
              ? `[${report.researcher_username}](https://bugcrowd.com${report.researcher_profile_path})`
              : "~~Private User~~"
          }\n` +
          `• **Target:** ${report.target}\n` +
          (report.disclosed
            ? `• **[Link](https://bugcrowd.com/${report.disclosure_report_url})**`
            : "")
      )
      .setThumbnail(report.logo_url || "https://i.imgur.com/AfFp7pu.png")
      .setTimestamp();

    await webhookClient.send({
      username: "OhMyBounty",
      avatarURL: "https://i.imgur.com/8uE8voU.jpeg",
      embeds: [embed],
    });
  } catch (e) {
    console.log(e);
  }
};

export const sendDiscordSubdomain = async (message, localImage) => {
  try {
    const webhookClient = new WebhookClient({
      url: process.env.DISCORD_WEBHOOK_URL || "",
    });

    const attachment = new AttachmentBuilder(
      fs.readFileSync(localImage),
      "subdomains.png"
    );
    webhookClient.send({
      username: "OhMyBounty",
      avatarURL: "https://i.imgur.com/8uE8voU.jpeg",
      content: message,

      files: [attachment],
    });
  } catch (e) {
    console.log(e);
  }
};
