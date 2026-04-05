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
           deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
       }
       throw new ApiError(400, err.message || "Failed to save expenditure.");
   }
};

const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    const { month, year } = req.query;

    if (!year) {
        throw new ApiError(400, "Please provide at least a year to view the expenditure report.");
    }

    const query: any = { year: year as string };
    if (month) {
        query.month = month as string;
    }

    const expenditures = await CompanyExpenditure.find(query)
        .populate("dataEnteredBY", "name email role is_Active Permissions")
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

    // 1. EARLY VALIDATION
    if (!_id) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Provide the expenditure _id to update its details.");
    }
    if (paymentProof && !file) {
        throw new ApiError(400, "You provided an old document to replace, but forgot to upload the new file.");
    }

    if (Object.keys(updateData).length === 0 && !file) {
        throw new ApiError(400, "Provide at least one field or a new file to update.");
    }

    // 2. MAIN EXECUTION BLOCK
    try {
        if (paymentProof) {
            try {
                const domain = process.env.PUBLICDOMAIN as string;
                if (paymentProof.includes(domain)) {
                    const oldkey = (paymentProof as string).split(`${domain}/`)[1];
                    if (oldkey) {
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

        if (!updatedExpenditure) {
            throw new ApiError(404, "Expenditure record does not exist with the provided ID.");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, updatedExpenditure, "Expenditure details updated successfully"));

    } catch (err: any) {
        // 3. CENTRALIZED CLEANUP
        if (file) {
            console.log("Database error. Deleting orphaned newly uploaded file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update expenditure.");
    }
};

export { addPaymentHandler, viewAllPaymentHandler, updatePaymentdetailsHandler };