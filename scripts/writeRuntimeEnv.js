require("dotenv").config();

const fs = require("fs");
const path = require("path");

const runtimeConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
};

const outputPath = path.join(__dirname, "..", "src", "runtime-env.js");
const content = `window.DREAM_ANATOMY_ENV = ${JSON.stringify(runtimeConfig, null, 2)};\n`;

fs.writeFileSync(outputPath, content, "utf8");
