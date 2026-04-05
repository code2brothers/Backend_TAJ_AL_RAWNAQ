import {Response} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {CompanyPaymentToOwner} from"../models/companyPaymentToOwner_Monthly.model.js"
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";
import {multerS3File} from "../constants.js";
import {ApiError} from "../utils/ApiError.js";


const addPaymentHandler = async (req: AuthRequest, res: Response) => {
    const {
        company_id,
        amount,
        dateofPayment,
        month,
        year,
        paymentMode,
        transactionId,
        remarks
    } = req.body;

    const file = req.file as multerS3File;

    // 1. EARLY VALIDATION (Fail Fast)
    if (!company_id || !amount || !month || !year || !paymentMode) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Please provide all required payment details, including the Company ID.");
    }

    // 2. DUPLICATE CHECK
    const existingPayment = await CompanyPaymentToOwner.findOne({
        company_id,
        month : (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase(),
        year
    });

    if (existingPayment) {
        if (file) {
            // Must delete the file if we reject the duplicate!
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error on duplicate:", e));
        }
        // 409 Conflict
        throw new ApiError(409, `A payment for this company in ${month} ${year} has already been recorded!`);
    }

    // 3. SAFE EXECUTION
    try {
        let paymentProofUrl;

        if (file) {
            paymentProofUrl = await getFileUrl(file.key);
        }

        // Create the record immediately (Lightning fast!)
        const newPayment = await CompanyPaymentToOwner.create({
            company_id,
            dataEnteredBY: req.user?._id,
            amount,
            dateofPayment: dateofPayment || new Date(),
            month : (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase(),
            year,
            paymentMode,
            transactionId,
            remarks,
            paymentProof: paymentProofUrl ?? ""
        });

        return res
            .status(201)
            .json(new ApiResponse(201, newPayment, "Company payment recorded successfully"));

    } catch (err: any) {
        // 4. SAFE CLEANUP
        if (file) {
            console.log("Database error. Deleting orphaned file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        throw new ApiError(400, err.message || "Failed to save company payment.");
    }
};

const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    const { month, year } = req.query;

    if (!year) {
        throw new ApiError(400, "Please provide at least year to view the payment report.");
    }

    const matchFilter : any ={year:year as string};
    if(month){
        matchFilter.month = (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase();
    }

    const monthlyPayments = await CompanyPaymentToOwner.aggregate([
        {
            $match: matchFilter
        },
        {
            $lookup: {
                from: "companies",
                localField: "company_id",
                foreignField: "_id",
                as: "companyInfo"
            }
        },
        {
            $unwind: "$companyInfo"
        },
        {
            $lookup: {
                from: "users",
                localField: "dataEnteredBY",
                foreignField: "_id",
                as: "dataEnteredBY"
            }
        },
        {
            $unwind: {
                path: "$dataEnteredBY",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $sort: { dateofPayment: -1 }
        },
        {
            $project: {
                "companyInfo.createdAt": 0,
                "companyInfo.updatedAt": 0,
                "companyInfo.__v": 0,
                "dataEnteredBY.password": 0,
                "dataEnteredBY.refreshToken": 0,
                "dataEnteredBY.createdAt": 0,
                "dataEnteredBY.updatedAt": 0,
                "dataEnteredBY.__v": 0
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, monthlyPayments, `Payments for ${month} ${year} fetched successfully`));
};

const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
    const { _id, paymentProof, ...updateData } = req.body;
    const file = req.file as multerS3File;

    // 1. EARLY VALIDATION
    if (!_id) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Provide the payment _id to update its details.");
    }

    // Prevent sending old URL without new file
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

        const forbiddenFields = [
            "company_id",
            "dataEnteredBY",
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
        const updatedPayment = await CompanyPaymentToOwner.findByIdAndUpdate(
            _id,
            mongooseCommand,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!updatedPayment) {
            throw new ApiError(404, "Payment record does not exist with the provided ID.");
        }

        return res
            .status(200)
            .json(new ApiResponse(200, updatedPayment, "Company payment details updated successfully"));

    } catch (err: any) {
        // 3. CENTRALIZED CLEANUP
        if (file) {
            console.log("Database error. Deleting orphaned newly uploaded file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update payment details.");
    }
};

export {addPaymentHandler,viewAllPaymentHandler,updatePaymentdetailsHandler}