import { S3Client, DeleteObjectCommand} from "@aws-sdk/client-s3";

// 1. Initialize Cloudflare R2 Client
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

// ==========================================
// C. GET VIEW URL (For your Controller)
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
//import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
// ==========================================
// export const getFileUrl = async (fileKey: string) => {
//   try {
//     const command = new GetObjectCommand({
//       Bucket: BUCKET_NAME,
//       Key: fileKey,
//     });
//     // URL expires in 1 hour
//     return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
//   } catch (error) {
//     console.error("URL Gen Error:", error);
//     return null;
//   }
// };


const getFileUrl = async (fileKey:string) => {
  return `${process.env.PUBLICDOMAIN}/${fileKey}`;
};


export {s3Client,BUCKET_NAME,deleteFileFromCloudFlare,getFileUrl}