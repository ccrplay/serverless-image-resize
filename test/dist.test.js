const AWS = require("aws-sdk");
const { handler } = require("../dist/index");
const fs = require("fs");
const path = require("path");

jest.mock("aws-sdk", () => {
  const S3 = {
    getObject: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return {
    S3: jest.fn(() => S3),
  };
});

describe("Lambda@Edge Handler", () => {
  it("should resize the image and return the response", async () => {
    const imagePath = path.resolve(__dirname, "./test.png");
    const imageBuffer = fs.readFileSync(imagePath);

    AWS.S3().getObject().promise.mockResolvedValue({ Body: imageBuffer });

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
