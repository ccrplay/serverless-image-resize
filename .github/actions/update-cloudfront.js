const AWS = require("aws-sdk");

const cloudfront = new AWS.CloudFront();
const lambda = new AWS.Lambda();
const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME;
const lambdaFunctionVersion = process.env.LAMBDA_FUNCTION_VERSION;

async function updateCloudFrontDistribution() {
  try {
    // Get Lambda function ARN
    const lambdaResult = await lambda
      .getFunction({ FunctionName: lambdaFunctionName })
      .promise();
    const lambdaArn = `${lambdaResult.Configuration.FunctionArn}:${lambdaFunctionVersion}`;

    // Get current CloudFront distribution config
    const distributionConfigResult = await cloudfront
      .getDistributionConfig({ Id: distributionId })
      .promise();
    const etag = distributionConfigResult.ETag;
    const distributionConfig = distributionConfigResult.DistributionConfig;

    // Update LambdaFunctionAssociations
    const lambdaFunctionAssociations =
      distributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items;
    const lambdaFunctionIndex = lambdaFunctionAssociations.findIndex(
      item => item.EventType === "origin-response"
    );

    if (lambdaFunctionIndex !== -1) {
      lambdaFunctionAssociations[lambdaFunctionIndex].LambdaFunctionARN =
        lambdaArn;
    } else {
      lambdaFunctionAssociations.push({
        LambdaFunctionARN: lambdaArn,
        EventType: "origin-response",
        IncludeBody: false,
      });
      distributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Quantity += 1;
    }

    // Update CloudFront distribution config
    const updateParams = {
      Id: distributionId,
      IfMatch: etag,
      DistributionConfig: distributionConfig,
    };

    await cloudfront.updateDistribution(updateParams).promise();
    console.log("CloudFront distribution updated successfully");
  } catch (error) {
    console.error("Error updating CloudFront distribution:", error);
    process.exit(1);
  }
}

updateCloudFrontDistribution();
