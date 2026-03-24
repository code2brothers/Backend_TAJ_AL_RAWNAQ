import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";
// Make sure to import all 3 models!
import { CompanyPaymentToOwner } from "../models/companyPaymentToOwner_Monthly.model.js";
import { OwnerPaymentToWorker } from "../models/ownerPaymentToWorker_Monthly.model.js";
import { CompanyExpenditure } from "../models/companyExpenditure.model.js";

export const company_OverviewHandler = async (req: AuthRequest, res: Response) => {
    // Optional: Let the frontend filter by a specific year (e.g., ?year=2026)
    // If no year is provided, it fetches all-time data.
    const { year } = req.query;
    const matchStage = year ? { $match: { year: year as string } } : { $match: {} };

    // ============================================================================
    // 1. INFLOW: Company Payments (Money coming IN)
    // ============================================================================
    const incomePromise = CompanyPaymentToOwner.aggregate([
        matchStage,
        {
            $lookup: {
                from: "companies",
                localField: "company_id",
                foreignField: "_id",
                as: "companyInfo"
            }
        },
        { $unwind: { path: "$companyInfo", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                month: 1,
                year: 1,
                amount: 1,
                "companyInfo.companyName": 1,
                "companyInfo.registrationNo": 1
            }
        }
    ]);

    // ============================================================================
    // 2. OUTFLOW: Worker Payments (Money going OUT to manpower)
    // ============================================================================
    const workerExpensePromise = OwnerPaymentToWorker.aggregate([
        matchStage,
        {
            $project: {
                month: 1,
                year: 1,
                companyName: 1, // Based on your ERD, this is already a string here
                // Here is the dynamic math calculation you asked for!
                amount: { $multiply: ["$totalHours", "$hourRateToWorker"] }
            }
        }
    ]);

    // ============================================================================
    // 3. OUTFLOW: Company Expenditures (Money going OUT for internal overhead)
    // ============================================================================
    const internalExpensePromise = CompanyExpenditure.aggregate([
        matchStage,
        {
            $project: {
                month: 1,
                year: 1,
                amount: 1,
                purpose: 1
            }
        }
    ]);

    // ============================================================================
    // EXECUTE ALL 3 QUERIES SIMULTANEOUSLY FOR MAXIMUM SPEED
    // ============================================================================
    const [income, workerExpenses, internalExpenses] = await Promise.all([
        incomePromise,
        workerExpensePromise,
        internalExpensePromise
    ]);

    // Return everything in one clean object for the React frontend to plot!
    return res.status(200).json(new ApiResponse(200, {
        income,
        workerExpenses,
        internalExpenses
    }, "Dashboard financial data fetched successfully"));
};