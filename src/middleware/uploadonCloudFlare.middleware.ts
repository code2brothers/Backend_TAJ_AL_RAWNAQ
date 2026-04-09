import multer from "multer";
import multerS3 from "multer-s3";
import {BUCKET_NAME, s3Client} from "../utils/cloudflare.js";

const uploadOnCloudFlare = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE, // Auto-detects PDF/JPG/PNG
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            // Generates unique filename: "documents/1708523-random.pdf"
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            const cleanFileName = file.originalname.toLowerCase().replace(/\s+/g, '-');
            cb(null, `${uniqueSuffix}_${cleanFileName}`);
        }
    }),
    // limit = 1gb
    limits:{fileSize:1024 * 1024 * 1024}
});

export {uploadOnCloudFlare}