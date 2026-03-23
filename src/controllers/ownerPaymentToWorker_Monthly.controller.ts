import { Response, Router } from "express";
import { AuthRequest } from "../type/auth.interafce.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { OwnerPaymentToWorker } from "../models/ownerPaymentToWorker_Monthly.model.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";


const addPaymentHandler = async (req: AuthRequest, res: Response) => {
    const {
        worker_id,
        dateofPayment,
        transactionId,
        month,
        year,
        totalHours,
        hourRateFromCompany,
        hourRateToWorker,
        companyName,
        remarks
    } = req.body;

    // 2. Basic Validation
    if (!worker_id || !dateofPayment || !transactionId || !month || !year || !totalHours || !hourRateFromCompany || !hourRateToWorker || !companyName) {
        throw new ApiError(400, "Please provide all required payment details.");
    }
    //  3. duplicate check
    const existingPayment = await OwnerPaymentToWorker.findOne({
        worker_id,
        month,
        year
    });

    if (existingPayment) {
        // 409 Conflict is the perfect HTTP status code for duplicate data
        throw new ApiError(409, `A payment for this worker in ${month} ${year} has already been recorded!`);
    }

    // 4. Create the record immediately (Lightning fast!)
    const newPayment = await OwnerPaymentToWorker.create({
        worker_id,
        dataEnteredBY: req.user?._id,
        dateofPayment: dateofPayment || new Date(),
        month: (month as string).toLowerCase(),
        year,
        transactionId,
        totalHours,
        hourRateFromCompany,
        hourRateToWorker,
        companyName,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, newPayment, "Worker payment recorded successfully"));



}

const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    // 1. We take month and year from req.query (e.g., ?month=march&year=2026)
    const { month, year } = req.query;

    if (!month || !year) {
        throw new ApiError(400, "Please provide both month and year to view the payment report.");
    }


    // 2. The MongoDB Aggregation Pipeline
    const monthlyPayments = await OwnerPaymentToWorker.aggregate([
        // Stage 1: Filter the payments to only get the exact month and year requested
        {
            $match: {
                month: (month as string).toLowerCase(),
                year: year as string
            }
        },
        // Stage 2: The SQL "JOIN" equivalent.
        // Go to the 'workers' collection and find the matching document.
        {
            $lookup: {
                from: "workers",             // Mongoose automatically pluralizes and lowercases collection names!
                localField: "worker_id",     // The field in our Payment document
                foreignField: "_id",         // The exact matching field in the Worker document
                as: "workerInfo"             // What we want to call the new joined data
            }
        },
        // Stage 3: $lookup returns an array by default.
        // $unwind flattens that array into a single clean object.
        {
            $unwind: {
                path: "$workerInfo",
                preserveNullAndEmptyArrays: true  // Keep records even if worker not found
            }
        },
        // Stage 4: Sort by date of payment (Newest first)
        {
            $sort: { dateofPayment: -1 }
        },
        // Stage 5: Clean up the output.
        // Remove heavy/unnecessary fields from the worker details to make the API faster.
        {
            $project: {
                "workerInfo.createdAt": 0,
                "workerInfo.updatedAt": 0
            }
        }
    ]);


    // Even if the array is empty (no payments that month), we still return 200 OK.
    return res
        .status(200)
        .json(new ApiResponse(200, monthlyPayments, `Worker payments for ${month} ${year} fetched successfully`));
};

const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
    const { _id, ...updateData } = req.body;

    if (!_id) {
        throw new ApiError(400, "Provide the payment _id to update its details.");
    }

    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, "Provide at least one field to update.");
    }

    // ACCOUNTING SECURITY: The Forbidden List
    // These fields cannot be changed after creation
    const forbiddenFields = [
        "worker_id",
        "dataEnteredBY",
        "createdAt",
        "updatedAt",
        "payment_proof"
    ];

    forbiddenFields.forEach((field) => {
        if (updateData[field] !== undefined) {
            delete updateData[field];
        }
    });

    // Dynamic Database Command Builder
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
};

export { addPaymentHandler, viewAllPaymentHandler, updatePaymentdetailsHandler }
