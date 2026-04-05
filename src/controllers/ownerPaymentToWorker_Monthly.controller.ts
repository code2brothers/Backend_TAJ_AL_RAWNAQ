import { Response } from "express";
import { AuthRequest } from "../type/auth.interafce.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { OwnerPaymentToWorker } from "../models/ownerPaymentToWorker_Monthly.model.js";
import { Worker } from "../models/worker.model.js";
import { ApiError } from "../utils/ApiError.js";

import {multerS3File} from "../constants.js";
import {deleteFileFromCloudFlare, getFileUrl} from "../utils/cloudflare.js";

 const addPaymentHandler = async (req: AuthRequest, res: Response) => {
    const {
        passportNumber,
        dateofPayment,
        transactionId,
        month,
        year,
        totalHours,
        paymentMode,
        hourRateFromCompany,
        hourRateToWorker,
        companyName,
        remarks
    } = req.body;


    const file = req.file as multerS3File;

    // 1. EARLY VALIDATION
    if (
        !passportNumber ||
        !transactionId ||
        !month ||
        !year ||
        !totalHours ||
        !hourRateFromCompany ||
        !hourRateToWorker ||
        !companyName ||
        !paymentMode
    ) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Please provide the passport number and all required payment details.");
    }

    // 2. WORKER LOOKUP
    // Find the worker by their  Passport Number
    const worker = await Worker.findOne({ passportNumber });

    if (!worker) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error on missing worker:", e));
        }
        throw new ApiError(404, `No worker found in the system with Passport Number: ${passportNumber}`);
    }

    const worker_id = worker._id;


    // 3. DUPLICATE CHECK
    const existingPayment = await OwnerPaymentToWorker.findOne({
        worker_id,
        month:(month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase(),
        year
    });

    if (existingPayment) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error on duplicate:", e));
        }
        throw new ApiError(409, `A payment for this worker (Passport: ${passportNumber}) in ${month} ${year} has already been recorded!`);
    }

    // 4. SAFE EXECUTION
    try {
        let paymentProofUrl;

        if (file) {
            paymentProofUrl = await getFileUrl(file.key);
        }

        // Create the record
        const newPayment = await OwnerPaymentToWorker.create({
            worker_id,
            dataEnteredBY: req.user?._id,
            dateofPayment: dateofPayment || new Date(),
            month : (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase(),
            year,
            transactionId,
            totalHours,
            paymentMode,
            hourRateFromCompany,
            hourRateToWorker,
            companyName,
            remarks,
            paymentProof: paymentProofUrl ?? "",
        });

        return res
            .status(201)
            .json(new ApiResponse(201, newPayment, `Payment recorded successfully for Passport: ${passportNumber}`));

    } catch (err: any) {
        if (file) {
            console.log("Database error. Deleting orphaned file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        throw new ApiError(400, err.message || "Failed to save worker payment.");
    }
};

const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    const { month, year,passportNumber } = req.query;

    if (!year) {
        throw new ApiError(400, "Please provide at least a year to view payment info.");
    }

    const matchFilter: any = { year: year as string };
    if (month) {
        matchFilter.month = (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase();
    }
    if (passportNumber) {
       const worker = await Worker.findOne({passportNumber:passportNumber as string}).lean()
       if(!worker){
            throw new ApiError(404,"Worker not found")
        }
        matchFilter.worker_id = worker._id;
    }

    const monthlyPayments = await OwnerPaymentToWorker.aggregate([
        {
            $match: matchFilter
        },
        {
            $lookup: {
                from: "workers",
                localField: "worker_id",
                foreignField: "_id",
                as: "workerInfo"
            }
        },
        {
            $unwind: {
                path: "$workerInfo",
                preserveNullAndEmptyArrays: true
            }
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
                "workerInfo.createdAt": 0,
                "workerInfo.updatedAt": 0,
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
        .json(new ApiResponse(200, monthlyPayments, `Worker payments for ${month} ${year} fetched successfully`));
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
            "worker_id",
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
        const updatedPayment = await OwnerPaymentToWorker.findByIdAndUpdate(
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
            .json(new ApiResponse(200, updatedPayment, "Worker payment details updated successfully"));

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

export { addPaymentHandler, viewAllPaymentHandler, updatePaymentdetailsHandler }
