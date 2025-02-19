import "dotenv/config";
import logUpdate from "log-update";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "path";
import pc from "picocolors";
import { exit } from "process";
import { wait } from "./utils.ts";

//Path config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BANNER = `  ____  __   __  ___     ___                 __      
 / __ \/ /  /  |/  /_ __/ _ )___  __ _____  / /___ __
/ /_/ / _ \/ /|_/ / // / _  / _ \/ // / _ \/ __/ // /
\____/_//_/_/  /_/\_, /____/\___/\_,_/_//_/\__/\_, / 
                 /___/                        /___/  `;

//Types
type Engagement = {
  name: string;
  engagementCode: string;
  enabled: boolean;
  platform: string;
  changeLog: {
    enabled: boolean;
    filterBy: string[];
    lastTimeChanged: string | null;
  };
  crowdStream: {
    enabled: boolean;
    minimumPriorityNumber: string;
    filterBy: string[];
    lastTimeChanged: string | null;
  };
};

type Config = {
  platform: string[];
  engagements: Engagement[];
  monitorInterval: number;
  notifications: {
    telegram: boolean;
    discord: boolean;
  };
};

async function readConfig() {
  try {
    const data = await fs.readFile(
      path.join(__dirname, "config.json"),
      "utf-8"
    );
    const config: Config = JSON.parse(data);
    for (const engagement of config.engagements) {
      console.log(engagement.name);
      if (engagement.enabled) {
        logUpdate(pc.yellow(`[+] Monitoring ${engagement.name}`));
        if (engagement.changeLog.enabled) {
          //monitor changelog
        }
        if (engagement.crowdStream.enabled) {
          //monitor crowdstream
        }
      }
    }
  } catch (err) {
    console.log(err);
    exit(1);
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
  await showNeon();

  try {
    logUpdate(pc.yellow("[+] Reading config file"));
    await readConfig();
  } catch (err) {
    console.log(pc.red(err));
    exit(1);
  }
}
main();
