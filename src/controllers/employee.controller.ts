import {AuthRequest} from "../type/auth.interafce.js";
import {Response} from "express";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {multerS3File} from "../constants.js";
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";

const addNewEmployeeHandler =async (req:AuthRequest,res:Response)=>{
    const {name, email, password, role, Permissions} = req.body;
    const picFile = req.file as multerS3File | undefined;

    // 1. EARLY VALIDATION
    if (!name || !email || !password||!role) {
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
        throw new ApiError(400,"Name, email, password, and role are required.")
    }

    // 2. DUPLICATE CHECK
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
        throw new ApiError(409,"A employee with this email already exists in the system.")
    }

    // 3. SAFE EXECUTION
    try {
        // Process picture
        const pictureUrl = picFile ? await getFileUrl(picFile.key) : undefined;

        const newUser = await User.create({
            name,
            email,
            password,
            role: role ,
            Permissions: Permissions || [],
            ...(pictureUrl && { picture: pictureUrl }),
        });

        // Your `toJSON` transform automatically strips the password and __v before it sends!
        return res.status(201).json(new ApiResponse(201,newUser,"employee registered successfully!"));

    } catch (err: any) {
        // 4. SAFE CLEANUP (If database crashes)
        if (picFile) {
            console.log("Database error. Deleting orphaned employee picture:", picFile.key);
            deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup failed:", e));
        }

        throw new ApiError(400, err.message || "Failed to add new employee.");
    }
}

const viewAllEmployeeHandler =async(req:AuthRequest,res:Response)=>{

    const employees = await User.find({}).select("-password -refreshToken");

    res.status(200).json(new ApiResponse(200,employees,"All employees Fetched Successfully!"))


}


const updateEmployeedetailsHandler =async(req:AuthRequest,res:Response)=>{

        const { _id, ...updateData } = req.body;
        const picFile = req.file as multerS3File | undefined;

        // 1. EARLY VALIDATION
        if (!_id) {
            if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
            throw new ApiError(400, "Provide employee _id to update!");
        }

        if (Object.keys(updateData).length === 0 && !picFile) {
            throw new ApiError(400, "Provide at least one field to update!");
        }

        // 2. MAIN EXECUTION BLOCK
        try {
            // Fetch existing employee to get old picture URL
            const existingEmployee = await User.findById(_id);
            if (!existingEmployee) {
                if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
                throw new ApiError(404, "Employee not found with the provided ID.");
            }

            // If new picture uploaded, delete old picture from Cloudflare
            if (picFile) {
                if (existingEmployee.picture) {
                    try {
                        const domain = process.env.PUBLICDOMAIN as string;
                        if (existingEmployee.picture.includes(domain)) {
                            const oldPicKey = existingEmployee.picture.split(`${domain}/`)[1];
                            if (oldPicKey) {
                                deleteFileFromCloudFlare(oldPicKey).catch(e => console.error("Failed to delete old picture:", e));
                            }
                        }
                    } catch (cleanupError) {
                        console.error("Cloudflare Picture URL Parse Error:", cleanupError);
                    }
                }
                const pictureUrl = await getFileUrl(picFile.key);
                updateData.picture = pictureUrl;
            }

            const forbiddenFields = ["createdAt", "updatedAt"];

            forbiddenFields.forEach((field) => {
                if (updateData[field] !== undefined) {
                    delete updateData[field];
                }
            });

            const updatedEmployee = await User.findByIdAndUpdate(
                _id,
                {
                    $set: updateData,
                    $unset: { refreshToken: 1 }
                },
                {
                    returnDocument: "after",
                    runValidators: true
                }
            ).select("-password");

            return res
                .status(200)
                .json(new ApiResponse(200, updatedEmployee, "Employee details updated successfully"));

        } catch (err: any) {
            // 3. CENTRALIZED CLEANUP
            if (picFile) {
                console.log("Database error. Deleting orphaned newly uploaded picture:", picFile.key);
                deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup failed:", e));
            }

            const statusCode = err.statusCode || 400;
            throw new ApiError(statusCode, err.message || "Failed to update employee details.");
        }
}





export {addNewEmployeeHandler,viewAllEmployeeHandler,updateEmployeedetailsHandler}