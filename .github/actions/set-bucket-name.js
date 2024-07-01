const fs = require("fs");

let config = fs.readFileSync("src/config.js", "utf8");

const BUCKET_NAME = process.env.BUCKET_NAME;

config = config.replace(/BUCKET_NAME_PLACEHOLDER/g, BUCKET_NAME);

fs.writeFileSync("src/config.js", config);

console.log("BUCKET_NAME is set to", BUCKET_NAME);
