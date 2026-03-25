import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CompanyExpenditure } from "../models/companyExpenditure.model.js";
import {multerS3File} from "../constants.js";
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";

const addPaymentHandler = async (req: AuthRequest, res: Response) => {
    const {
        amount,
        purpose,
        paymentMode,
        dateofPayment,
        month,
        year,
        transactionId
    } = req.body;
    const file = req.file as multerS3File;
    if (!amount || !purpose || !month || !year || !paymentMode) {
        if (file) {
            // Fire and forget deletion if early validation fails
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Please provide amount, purpose, paymentMode, month, and year.");
    }

   try{
       let paymentProofUrl
       if(file){
           paymentProofUrl = await getFileUrl(file.key);
       }


       // Create the record
       const newExpenditure = await CompanyExpenditure.create({
           dataEnteredBY: req.user?._id,
           amount,
           paymentProof:paymentProofUrl ?? "",
           purpose,
           paymentMode,
           dateofPayment: dateofPayment || new Date(),
           month,
           year,
           transactionId
       });

       return res
           .status(201)
           .json(new ApiResponse(201, newExpenditure, "Company expenditure recorded successfully"));
   }catch (err: any) {
       if (file) {
           console.log("Database error. Deleting orphaned file:", file.key);
           // Notice we dropped 'await' and added '.catch()'.
           // This ensures a Cloudflare hiccup doesn't hide the real DB error!
           deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
       }
       throw new ApiError(400, err.message || "Failed to save expenditure.");
   }
};
// const addPaymentHandler = async (req: AuthRequest, res: Response) => {
//     const {
//         amount,
//         purpose,
//         paymentMode,
//         dateofPayment,
//         month,
//         year,
//         transactionId
//     } = req.body;
//     const file = req.file as multerS3File;
//     let paymentProofUrl
//     if(file){
//         paymentProofUrl = await getFileUrl(file.key);
//     }
//     // Basic Validation (Matches your ERD exactly)
//     if (!amount || !purpose || !month || !year||!paymentMode) {
//         if(file){
//             console.log("Validation failed. Deleting orphaned file:", file.key);
//             await deleteFileFromCloudFlare(file.key)
//         }
//         throw new ApiError(400, "Please provide amount, purpose, month, and year.");
//     }
//
//
//     // Create the record
//     const newExpenditure = await CompanyExpenditure.create({
//         dataEnteredBY: req.user?._id,
//         amount,
//         paymentProof:paymentProofUrl ?? "",
//         purpose,
//         paymentMode,
//         dateofPayment: dateofPayment || new Date(),
//         month,
//         year,
//         transactionId
//     });
//    if(!newExpenditure){
//        throw new ApiError(404, "Something Went wrong while saving Expenditure Data")
//    }
//     return res
//         .status(201)
//         .json(new ApiResponse(201, newExpenditure, "Company expenditure recorded successfully"));
// };




// 2. VIEW EXPENDITURES (Dynamic Month but you have to give Year)
const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    const { month, year } = req.query;

    if (!year) {
        throw new ApiError(400, "Please provide at least a year to view the expenditure report.");
    }

    // Build the dynamic query object
    const query: any = { year: year as string };
    if (month) {
        query.month = month as string;
    }

    // A simple, lightning-fast .find() because we don't need to join external companies!
    const expenditures = await CompanyExpenditure.find(query)
        .populate("dataEnteredBY", "name email role is_Active Permissions") // Optional: pulls in the name of the staff member who entered it
        .lean()
        .sort({ dateofPayment: -1 });

    const message = month
        ? `Expenditures for ${month} ${year} fetched successfully`
        : `Annual expenditures for the year ${year} fetched successfully`;

    return res
        .status(200)
        .json(new ApiResponse(200, expenditures, message));
};

const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
    const { _id, paymentProof, ...updateData } = req.body;
    const file = req.file as multerS3File;

    // ==========================================
    // 1. EARLY VALIDATION
    // ==========================================
    if (!_id) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Provide the expenditure _id to update its details.");
    }
    if (paymentProof && !file) {
        throw new ApiError(400, "You provided an old document to replace, but forgot to upload the new file.");
    }

    // FIX #1: Allow the request if they are AT LEAST sending a new file
    if (Object.keys(updateData).length === 0 && !file) {
        throw new ApiError(400, "Provide at least one field or a new file to update.");
    }

    // ==========================================
    // 2. MAIN EXECUTION BLOCK
    // ==========================================
    try {
        // FIX #2: Safe, Non-Blocking Old File Deletion
        if (paymentProof) {
            try {
                const domain = process.env.PUBLICDOMAIN as string;
                if (paymentProof.includes(domain)) {
                    const oldkey = (paymentProof as string).split(`${domain}/`)[1];
                    if (oldkey) {
                        // We don't await this so it doesn't slow down the response!
                        deleteFileFromCloudFlare(oldkey).catch(e => console.error("Failed to delete old file:", e));
                    }
                }
            } catch (cleanupError) {
                console.error("Cloudflare URL Parse Error:", cleanupError);
            }
        }

        // Process New File
        if (file) {
            const paymentProofUrl = await getFileUrl(file.key);
            updateData.paymentProof = paymentProofUrl;
        }

        // Security check
        const forbiddenFields = ["dataEnteredBY", "createdAt", "updatedAt"];
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
        const updatedExpenditure = await CompanyExpenditure.findByIdAndUpdate(
            _id,
            mongooseCommand,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        // FIX #3: Ensure the document actually existed in the DB
        if (!updatedExpenditure) {
            throw new ApiError(404, "Expenditure record does not exist with the provided ID.");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, updatedExpenditure, "Expenditure details updated successfully"));

    } catch (err: any) {
        // ==========================================
        // 3. CENTRALIZED CLEANUP
        // ==========================================
        if (file) {
            console.log("Database error. Deleting orphaned newly uploaded file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        // Pass the error (whether it's our 404 or a Mongoose crash) back to Express
        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update expenditure.");
    }
};

// const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
//     const { _id, ...updateData } = req.body;
//     const file = req.file as multerS3File;
//     if (!_id) {
//         if (file) {
//             // Fire and forget deletion if early validation fails
//             deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
//         }
//         throw new ApiError(400, "Provide the expenditure _id to update its details.");
//     }
//
//     if (Object.keys(updateData).length === 0) {
//         if (file) {
//             // Fire and forget deletion if early validation fails
//             deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
//         }
//         throw new ApiError(400, "Provide at least one field to update.");
//     }
//
//     // SECURITY: The Forbidden List (Only block system/audit fields now)
//     const forbiddenFields = ["dataEnteredBY", "createdAt", "updatedAt"];
//     forbiddenFields.forEach((field) => {
//         if (updateData[field] !== undefined) {
//             delete updateData[field];
//         }
//     });
//
//     // Smart $set / $unset routing
//     const setQuery: any = {};
//     const unsetQuery: any = {};
//
//     for (const key in updateData) {
//         const value = updateData[key];
//
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
//     const updatedExpenditure = await CompanyExpenditure.findByIdAndUpdate(
//         _id,
//         mongooseCommand,
//         {
//             returnDocument: "after",
//             runValidators: true
//         }
//     );
//
//     if (!updatedExpenditure) {
//         throw new ApiError(404, "Expenditure record does not exist with the provided ID.");
//     }
//
//     return res
//         .status(200)
//         .json(new ApiResponse(200, updatedExpenditure, "Expenditure details updated successfully"));
// };

export { addPaymentHandler, viewAllPaymentHandler, updatePaymentdetailsHandler };