import axios from "axios";
import * as cheerio from "cheerio";
import "dotenv/config";
import logUpdate from "log-update";
import cron from "node-cron";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "path";
import pc from "picocolors";
import { exit } from "process";
import {
  sendTelegramMessage,
  sendTelegramMessageWithImage,
  wait,
} from "./utils.ts";

//Path config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANNER = `  ____  __   __  ___     ___                 __      
 / __ \/ /  /  |/  /_ __/ _ )___  __ _____  / /___ __
/ /_/ / _ \/ /|_/ / // / _  / _ \/ // / _ \/ __/ // /
\____/_//_/_/  /_/\_, /____/\___/\_,_/_//_/\__/\_, / 
                 /___/                        /___/  `;

//Types
type Announcement = {
  enabled: boolean;
  lastTimeChanged: string | null;
};
type CrowdStream = {
  enabled: boolean;
  minimumPriorityNumber: string;
  filterBy: string[];
  lastTimeChanged: string | null;
};
type Engagement = {
  name: string;
  engagementCode: string;
  enabled: boolean;
  platform: string;
  announcements: Announcement;
  crowdStream: CrowdStream;
};

type Config = {
  platform: string[];
  engagements: Engagement[];
  cronInterval: string;
  notifications: {
    telegram: boolean;
    discord: boolean;
  };
};
const data = await fs.readFile(path.join(__dirname, "config.json"), "utf-8");
let config: Config = JSON.parse(data);

async function checkAnnouncements(engagement: Engagement) {
  try {
    const url = `https://bugcrowd.com/engagements/${engagement.engagementCode}/announcements.json`;
    const res = await axios.get(url);
    const announcements = res.data.announcements;
    if (engagement.announcements.lastTimeChanged === null) {
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.announcements.lastTimeChanged =
          new Date().toISOString();
      }
    } else {
      for (const announcement of announcements) {
        if (
          announcement.publishedAt > engagement.announcements.lastTimeChanged &&
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
            //TODO: Send discord notification
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
        engagementToUpdate.announcements.lastTimeChanged =
          new Date().toISOString();
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
  }
}

async function checkCrowdStream(engagement: Engagement) {
  try {
    const url = `https://bugcrowd.com/engagements/${
      engagement.engagementCode
    }/crowdstream.json?page=1&filter_by=${engagement.crowdStream.filterBy.join(
      ","
    )}`;
    const res = await axios.get(url);
    const crowdStream = res.data.results;
    if (engagement.crowdStream.lastTimeChanged === null) {
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.crowdStream.lastTimeChanged =
          new Date().toISOString();
      }
    } else {
      for (const report of crowdStream) {
        const reportDate = new Date(
          report.disclosed_at || report.accepted_at
        ).toISOString();

        if (
          reportDate > engagement.crowdStream.lastTimeChanged &&
          engagement.crowdStream.enabled
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
            message += `<i>• Priority:</i> ${report.priority}\n`;
            message += `<i>• Disclosed:</i> ${
              report.disclosed || report.accepted_at
            }\n`;
            message += `<i>• Bounty:</i> ${report.amount || 0} $\n`;
            message += `<i>• Points:</i> ${report.points || 0}\n`;
            message += `<i>• Status:</i> ${report.substate}\n`;
            message += report.researcher_username
              ? `<i>• Researcher:</i> <a href="https://bugcrowd.com${report.researcher_profile_path}">${report.researcher_username}</a>\n`
              : `<i>• Researcher:</i> <s>Private User</s>\n`;

            message += `<i>• Target:</i> ${report.target}\n`;
            message += report.disclosed
              ? `<i>• <a href="https://bugcrowd.com/${report.disclosure_report_url}">Link</a></i> \n`
              : "";

            await sendTelegramMessageWithImage(message, report.logo_url);
          }
          if (config.notifications.discord) {
            //TODO: Send discord notification
          }
        }
      }
      const engagementToUpdate = config.engagements.find(
        (e) => e.name === engagement.name
      );
      if (engagementToUpdate) {
        engagementToUpdate.crowdStream.lastTimeChanged =
          new Date().toISOString();
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
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
