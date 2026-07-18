require("dotenv").config();

const fs = require("fs");
const path = require("path");

const runtimeConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  PUBLIC_SUPPORT_EMAIL: process.env.PUBLIC_SUPPORT_EMAIL || ""
};

const outputPath = path.join(__dirname, "..", "src", "runtime-env.js");
const content = `window.DREAM_ANATOMY_ENV = ${JSON.stringify(runtimeConfig, null, 2)};\n`;

fs.writeFileSync(outputPath, content, "utf8");

const vendorDir = path.join(__dirname, "..", "src", "vendor");
const supabaseSourcePath = require.resolve("@supabase/supabase-js/dist/umd/supabase.js");
const supabaseOutputPath = path.join(vendorDir, "supabase.js");

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(supabaseSourcePath, supabaseOutputPath);
