import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {multerS3File} from "../constants.js";
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";
import * as url from "node:url";

const addNewCompanyHandler = async (req: AuthRequest, res: Response) => {
    const { companyName, registrationNo, ...restData } = req.body;

    // Basic validation: A company must at least have a name
    if (!companyName) {
        throw new ApiError(400, "Company Name is required to add a new company!");
    }

    // Check for duplicates to prevent database pollution
    // (Assuming company names or registration numbers should be unique)
    const existingCompany = await Company.findOne({
        $or: [{ companyName }, { registrationNo: registrationNo || null }]
    });

    if (existingCompany) {
        throw new ApiError(409, "A company with this Name or Registration Number already exists.");
    }
    // const files= req.files as multerS3File[]
    const fileKeys =[]
    for (const value of (req.files as multerS3File[])) {
        const url = await getFileUrl(value.key);
        fileKeys.push(url)
    }

    // Create the company
    const newCompany = await Company.create({
        companyName,
        registrationNo,
        documents:fileKeys,
        ...restData
    });

    return res
        .status(201)
        .json(new ApiResponse(201, newCompany, "Company successfully added to the system"));
};

const viewAllCompanyHandler = async (req: AuthRequest, res: Response) => {
    // Fetches all companies and sorts them newest first
    const companies = await Company.find().sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, companies, "All companies fetched successfully"));
};

// VIEW COMPANY DROPDOWN DATA
const viewAllCompanywithName_IdHandler = async (req: AuthRequest, res: Response) => {
    const companies = await Company.find()
        .select("_id companyName")
        .sort({ companyName: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, companies, "Company dropdown data fetched successfully"));
};

const updateCompanydetailsHandler = async (req: AuthRequest, res: Response) => {
    const { _id, ...updateData } = req.body;

    if (!_id) {
        throw new ApiError(400, "Provide the company's _id to update its details.");
    }

    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, "Provide at least one field to update.");
    }

    // Security: The Forbidden List
    const forbiddenFields = ["createdAt", "updatedAt"];
    forbiddenFields.forEach((field) => {
        if (updateData[field] !== undefined) {
            delete updateData[field];
        }
    });

    // Dynamic Database Command Builder (Smart $set / $unset routing)
    const setQuery: any = {};
    const unsetQuery: any = {};

    for (const key in updateData) {
        const value = updateData[key];

        // Strict Null Checking
        if (value === null) {
            unsetQuery[key] = 1; // Mark for complete deletion
        } else {
            setQuery[key] = value; // Mark for update/creation
        }
    }

    const mongooseCommand: any = {};
    if (Object.keys(setQuery).length > 0) mongooseCommand.$set = setQuery;
    if (Object.keys(unsetQuery).length > 0) mongooseCommand.$unset = unsetQuery;

    // Execute the update
    const updatedCompany = await Company.findByIdAndUpdate(
        _id,
        mongooseCommand,
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedCompany) {
        throw new ApiError(404, "Company does not exist with the provided ID.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedCompany, "Company details updated successfully"));
};


const addDocumentsHandler = async (req: AuthRequest, res: Response) => {
    const { id } = req.body;

    if (!id) {
        throw new ApiError(400, "Provide the company ID to add documents.");
    }

    if (!req.files || (req.files as multerS3File[]).length === 0) {
        throw new ApiError(400, "Please upload at least one document.");
    }

    //  Process the files and get their S3 URLs
    const fileKeys: string[] = [];
    for (const file of (req.files as multerS3File[])) {
        const url = await getFileUrl(file.key);
        fileKeys.push(url);
    }

    // 3. The Magic of $push and $each
    const updatedCompany = await Company.findByIdAndUpdate(
        id,
        {
            $push: {
                documents: { $each: fileKeys } // Appends all new URLs to the existing array
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedCompany) {
        throw new ApiError(404, "Company does not exist with the provided ID.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedCompany, "Documents added successfully"));
};

 const deleteAdocumentHandler = async (req: AuthRequest, res: Response) => {
    const { id, Fileurl } = req.body;

    if (!id || !Fileurl) {
        throw new ApiError(400, "Provide both the company ID and the File URL.");
    }
     if (typeof Fileurl !== "string") {
         throw new ApiError(400, "File URL must be a single string format.");
     }
        const key = Fileurl.split(`${process.env.PUBLICDOMAIN as string}/`)[1];
     console.log(key)
        if (key) {
            await deleteFileFromCloudFlare(key);
        }

    // 2. The Magic of $pull
    const updatedCompany = await Company.findByIdAndUpdate(
        id,
        {
            $pull: {
                documents: Fileurl // Tells MongoDB: "Find this exact string in the array and delete it"
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!updatedCompany) {
        throw new ApiError(404, "Company does not exist with the provided ID.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedCompany, "Document deleted successfully"));
};


export {
    addNewCompanyHandler,
    viewAllCompanyHandler,
    viewAllCompanywithName_IdHandler,
    updateCompanydetailsHandler,
    addDocumentsHandler,
    deleteAdocumentHandler
};