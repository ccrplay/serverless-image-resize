const esbuild = require("esbuild");
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

const build = () =>
  esbuild
    .build({
      entryPoints: ["src/index.js"],
      bundle: true,
      platform: "node",
      target: "node20",
      outfile: "dist/index.js",
      external: ["aws-sdk", "sharp"], // aws-sdk는 lambda runtime에 포함되어 있고, sharp는 바이너리 파일때문에 external로 설정
    })
    .catch(error => {
      console.log(error);

      process.exit(1);
    });

async function buildPackage() {
  const distPath = path.join(__dirname, "dist");

  await fs.ensureDir(distPath);

  // esbuild를 사용하여 번들링
  await build();

  // 번들링 된 파일을 위한 package.json 생성
  const minimalPackageJson = {
    dependencies: {
      sharp: require("sharp/package.json").version,
    },
  };
  await fs.writeJson(path.join(distPath, "package.json"), minimalPackageJson, {
    spaces: 2,
  });

  // sharp 설치
  process.chdir(distPath);
  execSync("npm install --platform=linux --arch=x64 sharp", {
    stdio: "inherit",
  });

  // 불필요한 sharp 파일 제거
  const sharpPath = path.join(distPath, "node_modules", "sharp");
  const removeList = [
    "vendor/8.10.6/win32-x64",
    "vendor/8.10.6/darwin-x64",
    "vendor/8.10.6/linux-arm64",
  ];

  removeList.forEach(item => {
    const itemPath = path.join(sharpPath, item);
    if (fs.existsSync(itemPath)) {
      fs.removeSync(itemPath);
    }
  });

  console.log("Build completed. Minimal Sharp installation in dist folder.");
}

buildPackage().catch(console.error);
