"use strict";

const querystring = require("querystring"); // Don't install.

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

// http://sharp.pixelplumbing.com/en/stable/api-resize/
const Sharp = require("sharp");

const s3Client = new S3Client({
  region: "ap-northeast-2", // 버킷을 생성한 리전 입력(여기선 서울)
});

const BUCKET = require("./config").BUCKET;

// Image types that can be handled by Sharp
const SUPPORT_IMAGE_TYPES = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "tiff",
];

const streamToBuffer = stream => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
};

const getImageFromS3 = ({ Bucket, Key }) => {
  return new Promise((resolve, reject) => {
    console.log("objectKey : ", Key);
    s3Client
      .send(
        new GetObjectCommand({
          Bucket,
          Key,
        })
      )
      .then(resolve)
      .catch(reject);
  });
};

const convertString = (string, { from, to }) => {
  if (!from || !to) return string.toLowerCase();
  return string.toLowerCase() === from ? to : string.toLowerCase();
};

const getValidatedQueryParams = request => {
  return new Promise((resolve, reject) => {
    const { uri, querystring: query } = request;
    const { w, h, q, f } = querystring.parse(query);

    console.log(`params: ${JSON.stringify(querystring.parse(query))}`);

    // 크기 조절이 없는 경우 원본 반환.
    if (!(w || h)) {
      return reject("No resizing parameters");
    }

    const extension = uri.match(/\/?(.*)\.(.*)/)[2].toLowerCase();

    if (!SUPPORT_IMAGE_TYPES.some(type => type === extension)) {
      return reject(`Unsupported image type : ${extension}`);
    }

    const width = parseInt(w, 10) || null;
    const height = parseInt(h, 10) || null;
    const quality = parseInt(q, 10) || 100;
    const format = convertString(f || extension, { from: "jpg", to: "jpeg" });

    // 포맷 변환이 없는 GIF 포맷 요청은 원본 반환.
    if (extension === "gif" && !f) {
      return reject("GIF format without format conversion");
    }

    return resolve({ width, height, quality, format });
  });
};

const getResizedImage = (imageBuffer, { width, height, format, quality }) =>
  new Promise(async (resolve, reject) => {
    const sharpInstance = Sharp(imageBuffer);

    const { width: originWidth, height: originHeight } =
      await sharpInstance.metadata();

    // 원본 이미지보다 크게 요청할 경우 원본 반환.
    if (originWidth < (width ?? 0) || originHeight < (height ?? 0)) {
      return reject("Requested size is larger than the original image");
    }

    sharpInstance
      .resize(width, height)
      .toFormat(format, {
        quality,
      })
      .withMetadata() // 이미지 크기조절시 임의로 이미지 회전하는 상황 방지
      .toBuffer()
      .then(resizedImage => {
        if (Buffer.byteLength(resizedImage, "base64") >= 1048576) {
          return reject("The response image size is over 1MB");
        }
        return resolve(resizedImage);
      })
      .catch(error => {
        return reject(`Sharp Error: ${JSON.stringify(error)}`);
      });
  });

exports.handler = async (event, context, callback) => {
  const { request, response } = event.Records[0].cf;

  const { width, height, quality, format } = await getValidatedQueryParams(
    request
  ).catch(error => {
    console.log("Invalid query parameters", error);

    return callback(null, response);
  });

  const s3Image = await getImageFromS3({
    Bucket: BUCKET,
    Key: decodeURIComponent(request.uri).substring(1),
  }).catch(error => {
    console.log("Error from getImageFromS3 : ", error);

    return callback(null, response);
  });

  const imageBuffer = await streamToBuffer(s3Image.Body).catch(error => {
    console.log("Error from streamToBuffer : ", error);

    return callback(null, response);
  });

  const resizedImage = await getResizedImage(imageBuffer, {
    width,
    height,
    format,
    quality,
  }).catch(error => {
    console.log("Error from getResizedImage : ", error);

    return callback(null, response);
  });

  console.log("Success resizing image");

  return callback(null, {
    ...response,
    body: resizedImage.toString("base64"),
    contentHeader: [
      {
        key: "Content-Type",
        value: `image/${format}`,
      },
    ],
    bodyEncoding: "base64",
  });
};
