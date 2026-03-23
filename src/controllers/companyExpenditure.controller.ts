import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CompanyExpenditure } from "../models/companyExpenditure.model.js";

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

    // Basic Validation (Matches your ERD exactly)
    if (!amount || !purpose || !month || !year||!paymentMode) {
        throw new ApiError(400, "Please provide amount, purpose, month, and year.");
    }

    // Create the record
    const newExpenditure = await CompanyExpenditure.create({
        dataEnteredBY: req.user?._id,
        amount,
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
};

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
    const { _id, ...updateData } = req.body;

    if (!_id) {
        throw new ApiError(400, "Provide the expenditure _id to update its details.");
    }

    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, "Provide at least one field to update.");
    }

    // SECURITY: The Forbidden List (Only block system/audit fields now)
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
};

export { addPaymentHandler, viewAllPaymentHandler, updatePaymentdetailsHandler };