import { RequestHandler } from "express";
import { deleteFileFromCloudFlare, getFileUrl } from "../utils/cloudflare.js";
import { ApiError } from "../utils/ApiError.js";
import { multerS3File } from "../constants.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const testing: RequestHandler = async (req, res) => {
    const file = req.file as multerS3File;
    const key = file.key;
    // for multiples files
    // const files= req.files as multerS3File[]
    if (!key) {
        throw new ApiError(400, "provide key");
    }
    const {name}= req.body
    console.log(name)
    console.log(req.body)
    const url = await getFileUrl(key);
    await deleteFileFromCloudFlare("1.jpg"); //for delete you have to pass key not url
    return res.status(200).json(new ApiResponse(200, { key }, "Uploaded!"));
};
// const testing =  (req:Request,res:Response)=> {
//     res.status(200).json("Working........")
// }
export { testing };
