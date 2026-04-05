import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {multerS3File} from "../constants.js";
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";

const addNewCompanyHandler = async (req: AuthRequest, res: Response) => {
    const { companyName, registrationNo, ...restData } = req.body;

    // 🔥 Extract files FIRST so we can clean them up if validations fail
    const filesMap = req.files as { [fieldname: string]: multerS3File[] } | undefined;
    const docFiles = filesMap?.documents || [];
    const picFile = filesMap?.picture?.[0];

    // Helper to clean up all uploaded files
    const cleanupAllFiles = () => {
        for (const doc of docFiles) {
            deleteFileFromCloudFlare(doc.key).catch(e => console.error("Cleanup error:", e));
        }
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
    };

    // 1. EARLY VALIDATION
    if (!companyName) {
        cleanupAllFiles();
        throw new ApiError(400, "Company Name is required to add a new company!");
    }

    // 2. DUPLICATE CHECK
    const existingCompany = await Company.findOne({
        $or: [{ companyName }, { registrationNo: registrationNo || null }]
    });

    if (existingCompany) {
        cleanupAllFiles();
        throw new ApiError(409, "A company with this Name or Registration Number already exists.");
    }

    // 3. SAFE EXECUTION
    try {
        // Process uploaded document files into document objects
        const documentObjects = [];
        for (const value of docFiles) {
            const fileUrl = await getFileUrl(value.key);
            documentObjects.push({
                link: fileUrl,
                description: value.originalname || "Document",
                date: new Date().toISOString(),
            });
        }

        // Process picture
        const pictureUrl = picFile ? await getFileUrl(picFile.key) : undefined;

        // Create the company
        const newCompany = await Company.create({
            companyName,
            registrationNo,
            documents: documentObjects,
            ...(pictureUrl && { picture: pictureUrl }),
            ...restData
        });

        return res
            .status(201)
            .json(new ApiResponse(201, newCompany, "Company successfully added to the system"));

    } catch (err: any) {
        // 4. SAFE CLEANUP (If database crashes)
        cleanupAllFiles();
        throw new ApiError(400, err.message || "Failed to add new company.");
    }
};

const viewAllCompanyHandler = async (req: AuthRequest, res: Response) => {
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
    const picFile = req.file as multerS3File | undefined;

    // 1. EARLY VALIDATION
    if (!_id) {
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
        throw new ApiError(400, "Provide the company's _id to update its details.");
    }

    if (Object.keys(updateData).length === 0 && !picFile) {
        throw new ApiError(400, "Provide at least one field to update.");
    }

    // 2. MAIN EXECUTION BLOCK
    try {
        // Fetch existing company to get old picture URL
        const existingCompany = await Company.findById(_id);
        if (!existingCompany) {
            if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
            throw new ApiError(404, "Company does not exist with the provided ID.");
        }

        // If new picture uploaded, delete old picture from Cloudflare
        if (picFile) {
            if (existingCompany.picture) {
                try {
                    const domain = process.env.PUBLICDOMAIN as string;
                    if (existingCompany.picture.includes(domain)) {
                        const oldPicKey = existingCompany.picture.split(`${domain}/`)[1];
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
                unsetQuery[key] = 1;
            } else {
                setQuery[key] = value;
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

        return res
            .status(200)
            .json(new ApiResponse(200, updatedCompany, "Company details updated successfully"));

    } catch (err: any) {
        // 3. CENTRALIZED CLEANUP
        if (picFile) {
            console.log("Database error. Deleting orphaned newly uploaded picture:", picFile.key);
            deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup failed:", e));
        }

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update company details.");
    }
};


const addDocumentsHandler = async (req: AuthRequest, res: Response) => {
    const { id, descriptions } = req.body;

    // 🔥 Extract files FIRST so we can clean them up if validations fail
    const files = req.files as multerS3File[] | undefined;

    // Helper to clean up all uploaded files
    const cleanupAllFiles = () => {
        if (files) {
            for (const f of files) {
                deleteFileFromCloudFlare(f.key).catch(e => console.error("Cleanup error:", e));
            }
        }
    };

    // 1. EARLY VALIDATION
    if (!id) {
        cleanupAllFiles();
        throw new ApiError(400, "Provide the company ID to add documents.");
    }

    if (!files || files.length === 0) {
        throw new ApiError(400, "Please upload at least one document.");
    }

    // 2. SAFE EXECUTION
    try {
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
            cleanupAllFiles();
            throw new ApiError(404, "Company does not exist with the provided ID.");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, updatedCompany, "Documents added successfully"));

    } catch (err: any) {
        // 3. SAFE CLEANUP (If database crashes)
        cleanupAllFiles();

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to add documents.");
    }
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
        if (key) {
            await deleteFileFromCloudFlare(key);
        }

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