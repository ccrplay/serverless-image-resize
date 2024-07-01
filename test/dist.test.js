const { S3Client } = require("@aws-sdk/client-s3");
const { handler } = require("../src/index");
const fs = require("fs");
const path = require("path");

jest.mock("@aws-sdk/client-s3", () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn(() => ({
      send: mockSend,
    })),
    GetObjectCommand: jest.fn(),
  };
});

describe("Lambda@Edge Handler", () => {
  it("should resize the image and return the response", async () => {
    const imagePath = path.resolve(__dirname, "./test.png");
    const imageBuffer = fs.readFileSync(imagePath);

    const mockS3Client = new S3Client({});
    mockS3Client.send.mockResolvedValue({
      Body: imageBuffer,
    });

    const event = {
      Records: [
        {
          cf: {
            request: {
              uri: "/test.png",
              querystring: "w=400&h=300",
            },
            response: {
              status: "200",
              statusDescription: "OK",
              headers: {
                "content-type": [{ key: "Content-Type", value: "image/png" }],
              },
            },
          },
        },
      ],
    };

    const callback = jest.fn();
    await handler(event, null, callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        status: 200,
        statusDescription: "OK",
        body: expect.any(String),
        headers: expect.objectContaining({
          "content-type": [{ key: "Content-Type", value: "image/png" }],
        }),
        bodyEncoding: "base64",
      })
    );
  });
});
