import axios from "axios";
import * as cheerio from "cheerio";
import "dotenv/config";
import logUpdate from "log-update";
import mysql from "mysql2/promise";
import cron from "node-cron";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "path";
import pc from "picocolors";
import { exit } from "process";
import puppeteer from "puppeteer";
import {
  sendDiscordMessage,
  sendDiscordReport,
  sendDiscordSubdomain,
  sendTelegramLocalImage,
  sendTelegramMessage,
  sendTelegramMessageWithImage,
  wait,
} from "./utils.js";

//Path config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANNER = `  ____  __   __  ___     ___                 __      
 / __ \/ /  /  |/  /_ __/ _ )___  __ _____  / /___ __
/ /_/ / _ \/ /|_/ / // / _  / _ \/ // / _ \/ __/ // /
\____/_//_/_/  /_/\_, /____/\___/\_,_/_//_/\__/\_, / 
                 /___/                        /___/  `;

const data = await fs.readFile(path.join(__dirname, "config.json"), "utf-8");
let config = JSON.parse(data);

async function checkAnnouncements(engagement) {
  try {
    const url = `https://bugcrowd.com/engagements/${engagement.engagementCode}/announcements.json`;
    const res = await axios.get(url);
    const announcements = res.data.announcements;
    const lastAnnouncementId = engagement.announcements.lastAnnouncementId;
    if (lastAnnouncementId === null) {
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.announcements.lastAnnouncementId =
          announcements[0].id;
      }
    } else {
      for (const announcement of announcements) {
        const announcementId = announcement.id;
        if (announcementId === lastAnnouncementId) {
          break;
        }
        if (
          announcementId !== lastAnnouncementId &&
          engagement.announcements.enabled
        ) {
          logUpdate(
            pc.green(
              `[+] New announcement in ${pc.cyan(engagement.name)}: ${pc.red(
                announcement.title || "Redacted"
              )}`
            )
          );
          logUpdate.done();
          //Send notification
          if (config.notifications.telegram) {
            //Send telegram notification
            logUpdate(pc.yellow(`[+] Sending notification to Telegram`));
            let message = `<b>📢 New announcement in <u>${engagement.name}</u> 📢</b>\n\n`;
            const parsedBody = cheerio.load(announcement.body);
            message += parsedBody.text();
            await sendTelegramMessage(message);
          }
          if (config.notifications.discord) {
            //Send discord notification
            logUpdate(pc.yellow(`[+] Sending notification to Discord`));
            const parsedBody = cheerio.load(announcement.body);
            const message = parsedBody.text();
            await sendDiscordMessage(
              `📢 New announcement in ${engagement.name} 📢 `,
              message
            );
          }
        } else {
          //Announcements come sorted by date, so we can break the loop
          break;
        }
      }
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.announcements.lastAnnouncementId =
          announcements[0].id;
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
  }
}

async function checkCrowdStream(engagement) {
  try {
    const url = `https://bugcrowd.com/engagements/${
      engagement.engagementCode
    }/crowdstream.json?page=1&filter_by=${engagement.crowdStream.filterBy.join(
      ","
    )}`;
    const res = await axios.get(url);
    const crowdStream = res.data.results;
    const lastReportId = engagement.crowdStream.lastReportId;
    if (lastReportId === null) {
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.crowdStream.lastReportId = crowdStream[0].id;
      }
    } else {
      for (const report of crowdStream) {
        const reportId = report.id;
        if (reportId === lastReportId) {
          break;
        }
        if (
          reportId !== lastReportId &&
          engagement.crowdStream.enabled &&
          report.priority <= engagement.crowdStream.minimumPriorityNumber
        ) {
          logUpdate(
            pc.green(
              `[+] New report in ${pc.cyan(engagement.name)}: ${pc.red(
                report.title || "Redacted"
              )}`
            )
          );
          logUpdate.done();
          //Send notification
          if (config.notifications.telegram) {
            //Send telegram notification
            logUpdate(pc.yellow(`[+] Sending notification to Telegram`));
            let message = `<b>🚨 New report in <a href="https://bugcrowd.com${report.engagement_path}">${engagement.name}</a> 🚨 </b>\n\n`;
            message += `<b>${report.title || "<s>Redacted</s>"}</b>\n\n`;
            message += `•<i> Priority:</i> ${report.priority}\n`;
            message += `•<i> Disclosed:</i> ${
              report.disclosed || report.accepted_at
            }\n`;
            message += `•<i> Bounty:</i> ${report.amount || 0} $\n`;
            message += `•<i> Points:</i> ${report.points || 0}\n`;
            message += `•<i> Status:</i> ${report.substate}\n`;
            message += report.researcher_username
              ? `•<i> Researcher:</i> <a href="https://bugcrowd.com${report.researcher_profile_path}">${report.researcher_username}</a>\n`
              : `•<i> Researcher:</i> <s>Private User</s>\n`;

            message += `•<i> Target:</i> ${report.target}\n`;
            message += report.disclosed
              ? `•<i> <a href="https://bugcrowd.com/${report.disclosure_report_url}">Link</a></i> \n`
              : "";

            await sendTelegramMessageWithImage(message, report.logo_url);
          }
          if (config.notifications.discord) {
            logUpdate(pc.yellow(`[+] Sending notification to Discord`));
            await sendDiscordReport(engagement, report);
          }
        }
      }
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.crowdStream.lastReportId = crowdStream[0].id;
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
  }
}

async function notifySubdomain(subdomain, engagement) {
  const imgPath = path.resolve("screenshots", "screenshot.png");
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: true,
    //executablePath: "/usr/bin/chromium-browser", //Delete this in Windows OS
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  logUpdate(pc.yellow(`[+] Checking `) + pc.cyan(subdomain));
  const page = await browser.newPage();
  page.setDefaultTimeout(10 * 60 * 1000); // 10 mins
  const URL = subdomain.includes("https://")
    ? subdomain
    : `https://${subdomain}`;
  try {
    let pageResponse;
    try {
      pageResponse = await page.goto(URL, {
        waitUntil: "networkidle2",
      });
    } catch (err) {
      console.log(pc.red(`[!] Timeout error for ${subdomain}`), err);
      await browser.close();
      return;
    }
    logUpdate(pc.green(`[+] ${subdomain} is up`));

    if (engagement.subdomainMonitor.screenshotEnabled) {
      await page.screenshot({
        type: "png",
        path: path.join("screenshots", "screenshot.png"),
      });
    }
    await browser.close();
    const headers = pageResponse.headers();
    if (engagement.subdomainMonitor.hideCodes.includes(pageResponse.status())) {
      logUpdate(
        pc.return(
          `[!] Status code ${pageResponse.status()} is in the hide list`
        )
      );
      return;
    }
    if (config.notifications.telegram) {
      logUpdate(pc.yellow(`[+] Sending notification to Telegram`));
      //Send telegram notification
      let message = `<b>🌐 New active subdomain found in <a href="https://bugcrowd.com/engagements/${engagement.engagementCode}">${engagement.name}</a> </b>\n\n`;
      message += `•<i> <a href="${URL}">${subdomain}</a> </i>\n`;
      message += `•<i> Status:</i> ${
        pageResponse.status() + " " + pageResponse.statusText()
      }\n`;
      message += `•<i> Response Time:</i> ${
        pageResponse.timing().receiveHeadersEnd
      } ms\n`;
      message += `•<i> Address:</i> ${
        pageResponse.remoteAddress().ip +
        ":" +
        pageResponse.remoteAddress().port
      } \n`;
      message += `•<i> Server:</i> ${headers["server"]}\n`;
      message += `•<i> Content-Type:</i> ${headers["content-type"]}\n`;
      engagement.subdomainMonitor.screenshotEnabled
        ? await sendTelegramLocalImage(message, imgPath)
        : await sendTelegramMessage(message);
    }
    if (config.notifications.discord) {
      logUpdate(pc.yellow(`[+] Sending notification to Discord`));
      //Send discord notification
      let messageMd;
      let title = `**🌐 New active subdomain found in [${engagement.name}](https://bugcrowd.com/engagements/${engagement.engagementCode})**\n`;
      if (engagement.subdomainMonitor.screenshotEnabled) {
        messageMd += title;
      }
      messageMd = `• *[${subdomain}](${URL})*\n`;
      messageMd += `• *Status:* ${pageResponse.status()} ${pageResponse.statusText()}\n`;
      messageMd += `• *Response Time:* ${
        pageResponse.timing().receiveHeadersEnd
      } ms\n`;
      messageMd += `• *Address:* ${pageResponse.remoteAddress().ip}:${
        pageResponse.remoteAddress().port
      }\n`;
      messageMd += `• *Server:* ${headers["server"]}\n`;
      messageMd += `• *Content-Type:* ${headers["content-type"]}\n`;
      messageMd =
        messageMd.length >= 250 ? messageMd.slice(0, 250) + "..." : messageMd;
      engagement.subdomainMonitor.screenshotEnabled
        ? await sendDiscordSubdomain(messageMd, imgPath)
        : await sendDiscordMessage(title, messageMd);
    }
  } catch (err) {
    console.log(err);
  } finally {
    //Remove the screenshot
    await browser.close();
    try {
      await fs.unlink(imgPath);
    } catch (err) {
      //Passssss
    }
  }
}
async function processFile(filePath, engagement, connection) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const subdomains = data.split("\n").map((subdomain) =>
      subdomain
        .trim()
        .replace(/\r?\n|\r/g, " ")
        .replace(/^https?:\/\//, "")
    );
    for (const subdomain of subdomains) {
      if (subdomain) {
        try {
          const [rows] = await connection.query(
            `SELECT * FROM \`${engagement.engagementCode}\` WHERE subdomain = ?`,
            [subdomain]
          );
          if (rows.length === 0) {
            logUpdate(pc.green(`[+] New subdomain found: ${subdomain}`));
            if (!engagement.subdomainMonitor.storeMode) {
              await notifySubdomain(subdomain, engagement);
            } else {
              logUpdate(pc.yellow(`[+] Storing new domain: ${subdomain}`));
            }

            await connection.query(
              `INSERT INTO \`${engagement.engagementCode}\` (subdomain) VALUES (?)`,
              [subdomain]
            );
          }
        } catch (err) {
          console.log(err);
        }
      }
    }
    //Remove the file
    await fs.unlink(filePath);
  } catch (err) {
    throw new Error(`[!] Error reading file: ${err}`);
  }
}
async function checkSubdomains(engagement) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "localhost",
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "omb",
    });
    //Create table if not exists
    const table = `
    CREATE TABLE IF NOT EXISTS \`${engagement.engagementCode}\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subdomain VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
    connection.query(table);

    // Read files from the program directory
    const files = await fs.readdir(
      engagement.subdomainMonitor.subdomainsDirectory
    );
    const txtFiles = files.filter((file) => path.extname(file) == ".txt");
    logUpdate(
      pc.yellow(
        `[i] Reading ${txtFiles.length} subdomains files for ${engagement.name}`
      )
    );
    logUpdate.done();
    // Process each .txt file
    for (const file of txtFiles) {
      await processFile(
        path.resolve(engagement.subdomainMonitor.subdomainsDirectory, file),
        engagement,
        connection
      );
    }
  } catch (err) {
    throw new Error(`[!] Error checking subdomains: ${err}`);
  }
}
async function readConfig() {
  try {
    for (const engagement of config.engagements) {
      if (engagement.enabled) {
        logUpdate(pc.yellow(`[+] Monitoring ${pc.cyan(engagement.name)}`));
        if (engagement.announcements.enabled) {
          //monitor changelog
          await checkAnnouncements(engagement);
        }
        if (engagement.crowdStream.enabled) {
          //monitor crowdstream
          await checkCrowdStream(engagement);
        }
        if (engagement.subdomainMonitor.enabled) {
          await checkSubdomains(engagement);
        }
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
  }
}
async function writeConfigToFile() {
  try {
    const updatedConfig = JSON.stringify(config, null, 2);
    await fs.writeFile(path.join(__dirname, "config.json"), updatedConfig);
    console.log(pc.green("[+] Config file updated successfully"));
  } catch (err) {
    console.error(pc.red(`[!] Error writing config file: ${err}`));
  }
}

async function showNeon() {
  const colors = [pc.cyan, pc.green, pc.yellow, pc.magenta, pc.red, pc.blue];
  let i = 0;
  while (i < 10) {
    logUpdate(colors[i % colors.length](BANNER));
    await wait(150);
    i++;
  }
  logUpdate.done();
}
async function main() {
  try {
    // Read file again to get the latest changes
    const data = await fs.readFile(
      path.join(__dirname, "config.json"),
      "utf-8"
    );
    config = JSON.parse(data);
    await readConfig();
    await writeConfigToFile();
    logUpdate.clear();
    logUpdate(pc.blue("[i] Waiting for next scheduled iteration"));
  } catch (err) {
    console.log(pc.red(err));
    exit(1);
  }
}
await showNeon();

const isConfigCronValid = cron.validate(config.cronInterval);
if (!isConfigCronValid) {
  console.log(pc.red(`[!] Invalid cron interval, using default value`));
}
const cronExpression = isConfigCronValid ? config.cronInterval : "* * * * *";

const task = cron.schedule(
  cronExpression,
  () => {
    main();
  },
  {}
);

console.log(pc.green(`[+] Scheduled task to run every ${cronExpression}`));

const monitoringList = config.engagements.filter((e) => e.enabled);
console.log(
  pc.yellow(
    `[+] Programs to monitor: ${pc.cyan(
      monitoringList.map((e) => e.name).join(", ")
    )}`
  )
);
task.start();
