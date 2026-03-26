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
    // Process uploaded files into document objects
    const documentObjects = [];
    for (const value of (req.files as multerS3File[])) {
        const fileUrl = await getFileUrl(value.key);
        documentObjects.push({
            link: fileUrl,
            description: value.originalname || "Document",
            date: new Date().toISOString(),
        });
    }

    // Create the company
    const newCompany = await Company.create({
        companyName,
        registrationNo,
        documents: documentObjects,
        ...restData
    });

    return res
        .status(201)
        .json(new ApiResponse(201, newCompany, "Company successfully added to the system"));
};

const viewAllCompanyHandler = async (req: AuthRequest, res: Response) => {
    // Use .lean() to get raw MongoDB data — avoids Mongoose subdocument casting issues
    // when documents array has mixed formats (old plain strings + new objects)
    const companies = await Company.find().sort({ companyName: 1 }).lean();

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
    const { id, descriptions } = req.body;

    if (!id) {
        throw new ApiError(400, "Provide the company ID to add documents.");
    }

    if (!req.files || (req.files as multerS3File[]).length === 0) {
        throw new ApiError(400, "Please upload at least one document.");
    }

    // Parse descriptions — may come as a JSON string array or a single string
    let descArray: string[] = [];
    if (descriptions) {
        try {
            descArray = typeof descriptions === "string" ? JSON.parse(descriptions) : descriptions;
        } catch {
            descArray = [descriptions];
        }
    }

    // Process files into document objects matching the schema
    const documentObjects = [];
    const files = req.files as multerS3File[];
    for (let i = 0; i < files.length; i++) {
        const fileUrl = await getFileUrl(files[i].key);
        documentObjects.push({
            link: fileUrl,
            description: descArray[i] || files[i].originalname || "Document",
            date: new Date().toISOString(),
        });
    }

    // Append new document objects to the existing array
    const updatedCompany = await Company.findByIdAndUpdate(
        id,
        {
            $push: {
                documents: { $each: documentObjects }
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
                documents: { link: Fileurl } // Match the document object by its link field
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