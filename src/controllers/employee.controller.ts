import {AuthRequest} from "../type/auth.interafce.js";
import {Response} from "express";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {ApiResponse} from "../utils/ApiResponse.js";

const addNewEmployeeHandler =async (req:AuthRequest,res:Response)=>{
    const {name, email, password, role, Permissions} = req.body;

    // 2. Basic Validation: Ensure the absolute minimum data is provided
    if (!name || !email || !password||!role) {
        throw new ApiError(400,"Name, email, password, and role are required.")
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new ApiError(409,"A employee with this email already exists in the system.")
    }

    const newUser = await User.create({
        name,
        email,
        password,
        role: role ,
        Permissions: Permissions || []      // Fallback to an empty array if no permissions are given yet
        // Note: is_Active defaults to `true` automatically via your schema!
    });

    // Your `toJSON` transform automatically strips the password and __v before it sends!
    return res.status(201).json(new ApiResponse(201,newUser,"employee registered successfully!"));



}

const viewAllEmployeeHandler =async(req:AuthRequest,res:Response)=>{

    const employees = await User.find({}).select("-password -refreshToken");

    res.status(200).json(new ApiResponse(200,employees,"All employees Fetched Successfully!"))


}


const updateEmployeedetailsHandler =async(req:AuthRequest,res:Response)=>{

        const { _id, ...updateData } = req.body;

        if (!_id) {
            throw new ApiError(400, "Provide employee _id to update!");
        }

        if (Object.keys(updateData).length === 0) {
            throw new ApiError(400, "Provide at least one field to update!");
        }

        const forbiddenFields = ["password", "createdAt", "updatedAt"];

        forbiddenFields.forEach((field) => {
            if (updateData[field] !== undefined) {
                delete updateData[field];
            }
        });

        const updatedEmployee = await User.findByIdAndUpdate(
            _id,
            {
                // Update the provided fields
                $set: updateData,

                // Example: If an admin updates a user, maybe you want to force them to log in again
                $unset: { refreshToken: 1 }
            },
            {
                returnDocument: "after", // Returns the newly updated document!
                runValidators: true      // Keeps your Mongoose schema rules active
            }
        ).select("-password");

        if (!updatedEmployee) {
            throw new ApiError(404, "Employee not found with the provided ID.");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, updatedEmployee, "Employee details updated successfully"));

}





export {addNewEmployeeHandler,viewAllEmployeeHandler,updateEmployeedetailsHandler}