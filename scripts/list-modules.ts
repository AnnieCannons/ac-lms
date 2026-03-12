import { createClient } from "@supabase/supabase-js";
import * as fs from "fs"; import * as path from "path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath,"utf-8").split("\n")) { const t=line.trim(); if(!t||t.startsWith("#")) continue; const idx=t.indexOf("="); if(idx===-1) continue; const k=t.slice(0,idx).trim(),v=t.slice(idx+1).trim().replace(/^["']|["']$/g,""); if(!process.env[k]) process.env[k]=v; } }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const courseId = process.argv[2];
const {data} = await sb.from("modules").select("title, week_number, order").eq("course_id", courseId).order("order");
(data??[]).forEach((m:any) => console.log(`W${String(m.week_number??'??').padStart(2,'0')} | ord ${m.order} | ${m.title}`));
