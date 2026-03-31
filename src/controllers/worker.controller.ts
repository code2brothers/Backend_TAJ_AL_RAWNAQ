import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { Worker } from "../models/worker.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { multerS3File } from "../constants.js";
import { deleteFileFromCloudFlare, getFileUrl } from "../utils/cloudflare.js";
import { CompanyPaymentToOwner } from "../models/companyPaymentToOwner_Monthly.model.js";

const addNewWorkerHandler = async (req: AuthRequest, res: Response) => {
    const { visaNumber, name, passportNumber, ...restData } = req.body;

    // 🔥 Extract files FIRST so we can clean them up if validations fail
    const files = req.files as { [fieldname: string]: multerS3File[] } | undefined;
    const docFile = files?.documents?.[0];
    const picFile = files?.picture?.[0];

    // ==========================================
    // 1. EARLY VALIDATION
    // ==========================================
    if (!visaNumber || !name) {
        if (docFile) deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup error:", e));
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
        throw new ApiError(400, "Visa Number and Name are required to add a new worker!");
    }

    // ==========================================
    // 2. DUPLICATE CHECK
    // ==========================================
    const existingWorker = await Worker.findOne({ passportNumber });
    if (existingWorker) {
        if (docFile) deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup error on duplicate:", e));
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error on duplicate:", e));
        throw new ApiError(409, "A worker with this Passport Number already exists in the system.");
    }

    // ==========================================
    // 3. SAFE EXECUTION
    // ==========================================
    try {
        // Generate URLs for uploaded files
        const docUrl = docFile ? await getFileUrl(docFile.key) : undefined;
        const picUrl = picFile ? await getFileUrl(picFile.key) : undefined;

        // Create the new worker
        const newWorker = await Worker.create({
            visaNumber,
            name,
            passportNumber,
            ...(docUrl && { documents: docUrl }),
            ...(picUrl && { picture: picUrl }),
            ...restData
        });

        return res
            .status(201)
            .json(new ApiResponse(201, newWorker, "Worker successfully added to the system"));

    } catch (err: any) {
        // ==========================================
        // 4. SAFE CLEANUP (If database crashes)
        // ==========================================
        if (docFile) {
            console.log("Database error. Deleting orphaned worker document:", docFile.key);
            deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup failed:", e));
        }
        if (picFile) {
            console.log("Database error. Deleting orphaned worker picture:", picFile.key);
            deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup failed:", e));
        }

        throw new ApiError(400, err.message || "Failed to add new worker.");
    }
};
const viewAllWorkerHandler = async (req: AuthRequest, res: Response) => {
    // Fetches all workers and sorts them so the newest additions appear first
    const workers = await Worker.find().sort({ visaExpiry: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, workers, "All workers fetched successfully"));
};



const viewOneWorkerHandler = async (req: AuthRequest, res: Response) => {
    // Assuming you set up your route like this: router.get("/:visaNumber", viewOneWorkerHandler)
    const { passportNumber } = req.params;

    if (!passportNumber) {
        throw new ApiError(400, "Please provide a passport  Number to search for.");
    }

    const worker = await Worker.findOne({ passportNumber });

    if (!worker) {
        throw new ApiError(404, "Worker does not exist with the provided Visa Number.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, worker, "Worker details fetched successfully"));
};

const updateWorkerdetailsHandler = async (req: AuthRequest, res: Response) => {
    const { _id, ...updateData } = req.body;
    const files = req.files as { [fieldname: string]: multerS3File[] } | undefined;
    const docFile = files?.newdocument?.[0];
    const picFile = files?.picture?.[0];

    // ==========================================
    // 1. EARLY VALIDATION
    // ==========================================
    if (!_id) {
        if (docFile) deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup error:", e));
        if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
        throw new ApiError(400, "Provide the worker _id to update its details.");
    }

    if (Object.keys(updateData).length === 0 && !docFile && !picFile) {
        throw new ApiError(400, "Provide at least one field or a new file to update.");
    }

    // ==========================================
    // 2. MAIN EXECUTION BLOCK
    // ==========================================
    try {
        // Fetch existing worker to get old file URLs
        const existingWorker = await Worker.findById(_id);
        if (!existingWorker) {
            if (docFile) deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup error:", e));
            if (picFile) deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup error:", e));
            throw new ApiError(404, "Worker does not exist with the provided ID.");
        }

        const domain = process.env.PUBLICDOMAIN as string;

        // If new document uploaded, delete old document from Cloudflare
        if (docFile) {
            if (existingWorker.documents) {
                try {
                    if (existingWorker.documents.includes(domain)) {
                        const oldkey = existingWorker.documents.split(`${domain}/`)[1];
                        if (oldkey) {
                            deleteFileFromCloudFlare(oldkey).catch(e => console.error("Failed to delete old document:", e));
                        }
                    }
                } catch (cleanupError) {
                    console.error("Cloudflare URL Parse Error:", cleanupError);
                }
            }
            const documentsUrl = await getFileUrl(docFile.key);
            updateData.documents = documentsUrl;
        }

        // If new picture uploaded, delete old picture from Cloudflare
        if (picFile) {
            if (existingWorker.picture) {
                try {
                    if (existingWorker.picture.includes(domain)) {
                        const oldPicKey = existingWorker.picture.split(`${domain}/`)[1];
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

        // =======================================================
        // ACCOUNTING SECURITY: The Forbidden List
        // =======================================================
        const forbiddenFields = [
            "createdAt",
            "updatedAt"
        ];

        forbiddenFields.forEach((field) => {
            if (updateData[field] !== undefined) {
                delete updateData[field];
            }
        });

        // Smart $set / $unset routing
        const setQuery: any = {};
        const unsetQuery: any = {};
        for (const key in updateData) {
            const value = updateData[key];
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
        const updatedWorker = await Worker.findByIdAndUpdate(
            _id,
            mongooseCommand,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        return res
            .status(200)
            .json(new ApiResponse(200, updatedWorker, "Worker details updated successfully"));

    } catch (err: any) {
        // ==========================================
        // 3. CENTRALIZED CLEANUP
        // ==========================================
        if (docFile) {
            console.log("Database error. Deleting orphaned newly uploaded document:", docFile.key);
            deleteFileFromCloudFlare(docFile.key).catch(e => console.error("Cleanup failed:", e));
        }
        if (picFile) {
            console.log("Database error. Deleting orphaned newly uploaded picture:", picFile.key);
            deleteFileFromCloudFlare(picFile.key).catch(e => console.error("Cleanup failed:", e));
        }

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update worker details.");
    }
};

// const updateWorkerdetailsHandler = async (req: AuthRequest, res: Response) => {
//     const { _id, ...updateData } = req.body;
//
//     if (!_id) {
//         throw new ApiError(400, "Provide the worker's _id to update their details.");
//     }
//
//     if (Object.keys(updateData).length === 0) {
//         throw new ApiError(400, "Provide at least one field to update.");
//     }
//
//     // The Forbidden List to prevent Mass Assignment vulnerability
//     const forbiddenFields = ["createdAt", "updatedAt"];
//     forbiddenFields.forEach((field) => {
//         if (updateData[field] !== undefined) {
//             delete updateData[field];
//         }
//     });
//
//     // Dynamic Database Command Builder
//     const setQuery: any = {};
//     const unsetQuery: any = {};
//
//     for (const key in updateData) {
//         const value = updateData[key];
//
//         // Strict Null Checking: Only delete the column if the frontend explicitly sends 'null'
//         if (value === null) {
//             unsetQuery[key] = 1;
//         } else {
//             setQuery[key] = value;
//         }
//     }
//
//     const mongooseCommand: any = {};
//     if (Object.keys(setQuery).length > 0) mongooseCommand.$set = setQuery;
//     if (Object.keys(unsetQuery).length > 0) mongooseCommand.$unset = unsetQuery;
//
//     // Execute the update
//     const updatedWorker = await Worker.findByIdAndUpdate(
//         _id,
//         mongooseCommand,
//         {
//             returnDocument: "after",
//             runValidators: true
//         }
//     );
//
//     if (!updatedWorker) {
//         throw new ApiError(404, "Worker does not exist.");
//     }
//
//     return res
//         .status(200)
//         .json(new ApiResponse(200, updatedWorker, "Worker details updated successfully"));
// };

// const updatedocumentHandler=async (req: AuthRequest, res: Response)=>{
//     const {_id,documents}= req.body;
//     if (!_id) {
//         throw new ApiError(400, "Please provide the payment record ID (_id).");
//     }
//     if (!documents) {
//         throw new ApiError(400, "Please provide the old paymentProof URL so it can be deleted.");
//     }
//     if (!req.file) {
//         throw new ApiError(400, "Please upload the new payment proof document.");
//     }
//
//     const file = req.file as multerS3File;
//     const key = file.key;
//     const newDocUrl = await getFileUrl(key);
//
//     if(!newDocUrl){
//         throw new ApiError(400,"Kindly Upload again Worker Document")
//     }
//
//     //  Delete
//     const oldkey = (documents as string).split(`${process.env.PUBLICDOMAIN}/`)[1]
//     await deleteFileFromCloudFlare(oldkey)
//
//     const updatedWorker =await Worker.findByIdAndUpdate(
//         _id,
//         {
//             documents:newDocUrl
//         },
//         {
//             returnDocument:"after",
//             runValidators:true
//         }
//     )
//     if (!updatedWorker) {
//         throw new ApiError(404, "Worker record does not exist with the provided ID.");
//     }
//
//    return  res
//             .status(200)
//             .json(new ApiResponse(200,updatedWorker,"Worker Document Updated Succesfully"))
//
// }


export {
    addNewWorkerHandler,
    updateWorkerdetailsHandler,
    viewAllWorkerHandler,
    viewOneWorkerHandler,
    
    // updatedocumentHandler
};