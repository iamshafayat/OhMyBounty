import axios from "axios";
import { EmbedBuilder, WebhookClient } from "discord.js";
const webhookClient = new WebhookClient({
  url: process.env.DISCORD_WEBHOOK_URL || "",
});

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

export const sendDiscordMessage = async (
  title: string,
  message: string,
  color?: number
) => {
  if (!webhookClient) {
    throw Error("Webhook client not defined.");
  }
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color || 0x00ff00)
    .setDescription(message);

  webhookClient.send({
    username: "OhMyBounty",
    avatarURL: "https://i.imgur.com/AfFp7pu.png",
    embeds: [embed],
  });
};

export const sendDiscordReport = async (engagement, report) => {
  const embed = new EmbedBuilder()
    .setTitle(`🚨 New report in ${engagement.name} 🚨`)
    .setURL(`https://bugcrowd.com${report.engagement_path}`)
    .setColor(0xff0000)
    .setDescription(
      `**${report.title || "~~Redacted~~"}**\n\n` +
        `• **Priority:** ${report.priority}\n` +
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
    avatarURL: "https://i.imgur.com/AfFp7pu.png",
    embeds: [embed],
  });
};
