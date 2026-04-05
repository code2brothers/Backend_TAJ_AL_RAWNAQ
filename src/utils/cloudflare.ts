import { S3Client, DeleteObjectCommand} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

const deleteFileFromCloudFlare = async (fileKey: string) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Delete Error:", error);
    return false;
  }
};

const getFileUrl = async (fileKey:string) => {
  return `${process.env.PUBLICDOMAIN}/${fileKey}`;
};

export {s3Client,BUCKET_NAME,deleteFileFromCloudFlare,getFileUrl}