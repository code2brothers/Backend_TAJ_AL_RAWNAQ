
export const DB_NAME ="Taj_AL_DB";


export interface multerS3File extends Express.Multer.File {
    key: string;
    location: string;
    bucket: string;
    etag: string;
}

export const options = {
    httpOnly: true,
    secure: true
}