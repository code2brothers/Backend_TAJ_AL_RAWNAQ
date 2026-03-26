import {Response, Router} from "express";
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

    // ==========================================
    // 1. EARLY VALIDATION (Fail Fast)
    // ==========================================
    if (!company_id || !amount || !month || !year || !paymentMode) {
        if (file) {
            // Fire and forget deletion if early validation fails
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Please provide all required payment details, including the Company ID.");
    }

    // ==========================================
    // 2. DUPLICATE CHECK
    // ==========================================
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
        // 409 Conflict is the perfect HTTP status code for duplicate data
        throw new ApiError(409, `A payment for this company in ${month} ${year} has already been recorded!`);
    }

    // ==========================================
    // 3. SAFE EXECUTION
    // ==========================================
    try {
        let paymentProofUrl;

        if (file) {
            paymentProofUrl = await getFileUrl(file.key);
        }

        // Create the record immediately (Lightning fast!)
        const newPayment = await CompanyPaymentToOwner.create({
            company_id,                        // The literal ID from the React dropdown
            dataEnteredBY: req.user?._id,      // The Staff Member from verifyJWT
            amount,
            dateofPayment: dateofPayment || new Date(),
            month : (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase(),                             // FIXED: Removed .toLowerCase() to match Dashboard logic
            year,
            paymentMode,
            transactionId,
            remarks,
            paymentProof: paymentProofUrl ?? "" // FIXED: Cleaner modern syntax
        });

        return res
            .status(201)
            .json(new ApiResponse(201, newPayment, "Company payment recorded successfully"));

    } catch (err: any) {
        // ==========================================
        // 4. SAFE CLEANUP
        // ==========================================
        if (file) {
            console.log("Database error. Deleting orphaned file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        throw new ApiError(400, err.message || "Failed to save company payment.");
    }
};
// const addPaymentHandler =async(req:AuthRequest,res:Response)=>{
//         const {
//             company_id,
//             amount,
//             dateofPayment,
//             month,
//             year,
//             paymentMode,
//             transactionId,
//             remarks
//         } = req.body;
//
//         // 2. Basic Validation
//         if (!company_id || !amount || !month || !year || !paymentMode) {
//             throw new ApiError(400, "Please provide all required payment details, including the Company ID.");
//         }
//        //  3. duplicate check
//     const existingPayment = await CompanyPaymentToOwner.findOne({
//         company_id,
//         month,
//         year
//     });
//
//     if (existingPayment) {
//         // 409 Conflict is the perfect HTTP status code for duplicate data
//         throw new ApiError(409, `A payment for this company in ${month} ${year} has already been recorded!`);
//     }
//
//     const file = req.file as multerS3File;
//     let paymentProofUrl
//     if(file){
//     const key = file.key;
//      paymentProofUrl = await getFileUrl(key);
//     }
//
//         // 4. Create the record immediately (Lightning fast!)
//         const newPayment = await CompanyPaymentToOwner.create({
//             company_id,                        // The literal ID from the React dropdown
//             dataEnteredBY: req.user?._id,      // The Staff Member from verifyJWT
//             amount,
//             dateofPayment: dateofPayment || new Date(),
//             month:(month as string).toLowerCase(),
//             year,
//             paymentMode,
//             transactionId,
//             remarks,
//             paymentProof: paymentProofUrl?paymentProofUrl:""
//         });
//
//         return res
//             .status(201)
//             .json(new ApiResponse(201, newPayment, "Company payment recorded successfully"));
//
//
//
// }

 const viewAllPaymentHandler = async (req: AuthRequest, res: Response) => {
    // 1. We take month and year from req.query (e.g., ?month=March&year=2026)
    const { month, year } = req.query;

    if (!year) {
        throw new ApiError(400, "Please provide at least year to view the payment report.");
    }

    const matchFilter : any ={year:year as string};
    if(month){
        matchFilter.month = (month as string).charAt(0).toUpperCase() + (month as string).slice(1).toLowerCase();
    }
    
    // 2. The MongoDB Aggregation Pipeline
    const monthlyPayments = await CompanyPaymentToOwner.aggregate([
        // Stage 1: Filter the payments to only get the exact month and year requested
        {
            $match: matchFilter
        },
        // Stage 2: The SQL "JOIN" equivalent.
        // Go to the 'companies' collection and find the matching document.
        {
            $lookup: {
                from: "companies",           // Mongoose automatically pluralizes and lowercases collection names!
                localField: "company_id",    // The field in our Payment document
                foreignField: "_id",         // The exact matching field in the Company document
                as: "companyInfo"            // What we want to call the new joined data
            }
        },
        // Stage 3: $lookup returns an array by default.
        // $unwind flattens that array into a single clean object.
        {
            $unwind: "$companyInfo"
        },
        // --- SECOND JOIN: Get the User (Admin/Staff) details ---
        {
            $lookup: {
                from: "users",                 // Mongoose automatically names the User collection "users"
                localField: "dataEnteredBY",   // The field in your Payment document
                foreignField: "_id",           // The matching ID in the User collection
                as: "dataEnteredBY"            // This overwrites the plain ID with the full User object!
            }
        },
        {
            $unwind: {
                path: "$dataEnteredBY",
                preserveNullAndEmptyArrays: true
            }
        },
        // Stage 4: Sort by date of payment (Newest first)
        {
            $sort: { dateofPayment: -1 }
        },
        // Stage 5 (Optional but Pro-level): Clean up the output.
        // Let's remove the heavy arrays (like documents) from the company details to make the API faster.
        {
            $project: {
                "companyInfo.createdAt": 0, // 0 means "exclude this field"
                "companyInfo.updatedAt": 0,
                "companyInfo.__v": 0,

            //     not send employee details
                "dataEnteredBY.password": 0,
                "dataEnteredBY.refreshToken": 0,
                "dataEnteredBY.createdAt": 0,
                "dataEnteredBY.updatedAt": 0,
                "dataEnteredBY.__v": 0
            }
        }
    ]);

    // Even if the array is empty (no payments that month), we still return 200 OK.
    return res
        .status(200)
        .json(new ApiResponse(200, monthlyPayments, `Payments for ${month} ${year} fetched successfully`));
};


 const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
    // We explicitly extract paymentProof so we know if they are trying to replace the old file!
    const { _id, paymentProof, ...updateData } = req.body;
    const file = req.file as multerS3File;

    // ==========================================
    // 1. EARLY VALIDATION
    // ==========================================
    if (!_id) {
        if (file) {
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup error:", e));
        }
        throw new ApiError(400, "Provide the payment _id to update its details.");
    }

    // Prevent the "Broken Link" trap: Old URL provided but no new file uploaded
    if (paymentProof && !file) {
        throw new ApiError(400, "You provided an old document to replace, but forgot to upload the new file.");
    }

    // Allow the request if they are at least sending a new file
    if (Object.keys(updateData).length === 0 && !file) {
        throw new ApiError(400, "Provide at least one field or a new file to update.");
    }

    // ==========================================
    // 2. MAIN EXECUTION BLOCK
    // ==========================================
    try {
        // Safe Old File Deletion (Non-Blocking)
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

        // =======================================================
        // ACCOUNTING SECURITY: The Forbidden List
        // =======================================================
        const forbiddenFields = [
            "company_id",      // Locked! Cannot change the company after creation.
            "dataEnteredBY",   // Locked! Cannot change who entered the data.
            "createdAt",
            "updatedAt"
            // Notice: 'paymentProof' was removed from this list so the URL can be updated!
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
        // ==========================================
        // 3. CENTRALIZED CLEANUP
        // ==========================================
        if (file) {
            console.log("Database error. Deleting orphaned newly uploaded file:", file.key);
            deleteFileFromCloudFlare(file.key).catch(e => console.error("Cleanup failed:", e));
        }

        const statusCode = err.statusCode || 400;
        throw new ApiError(statusCode, err.message || "Failed to update payment details.");
    }
};

 //  const updatePaymentdetailsHandler = async (req: AuthRequest, res: Response) => {
//     const { _id, ...updateData } = req.body;
//
//     if (!_id) {
//         throw new ApiError(400, "Provide the payment _id to update its details.");
//     }
//
//     if (Object.keys(updateData).length === 0) {
//         throw new ApiError(400, "Provide at least one field to update.");
//     }
//
//     // =======================================================
//     // 2. ACCOUNTING SECURITY: The Forbidden List
//     // We added the payment proof/PDF to this list.
//     // If the frontend tries to send it, the server silently deletes it!
//     // =======================================================
//     const forbiddenFields = [
//         "company_id",
//         "dataEnteredBY",
//         "createdAt",
//         "updatedAt",
//         "paymentProof"   // <--- Added! (Use this if your schema says paymentProof)
//     ];
//
//     forbiddenFields.forEach((field) => {
//         if (updateData[field] !== undefined) {
//             delete updateData[field];
//         }
//     });
//
//     // 3. Dynamic Database Command Builder
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
//     // 4. Execute the update
//     const updatedPayment = await CompanyPaymentToOwner.findByIdAndUpdate(
//         _id,
//         mongooseCommand,
//         {
//             returnDocument: "after",
//             runValidators: true
//         }
//     );
//
//     if (!updatedPayment) {
//         throw new ApiError(404, "Payment record does not exist with the provided ID.");
//     }
//
//     return res
//         .status(200)
//         .json(new ApiResponse(200, updatedPayment, "Payment details updated successfully"));
// };

 // const updatedocumentHandler=async (req: AuthRequest, res: Response)=>{
 //     const {_id,paymentProof}= req.body;
 //     if (!_id) {
 //         throw new ApiError(400, "Please provide the payment record ID (_id).");
 //     }
 //
 //     if (!req.file) {
 //         throw new ApiError(400, "Please upload the new payment proof document.");
 //     }
 //
 //     const file = req.file as multerS3File;
 //     const key = file.key;
 //     const paymentProofUrl = await getFileUrl(key);
 //
 //     if(!paymentProofUrl){
 //         throw new ApiError(400,"Kindly Upload again paymetProof")
 //     }
 //
 //     //  Delete
 //     if(paymentProof) {
 //         const oldkey = (paymentProof as string).split(`${process.env.PUBLICDOMAIN}/`)[1]
 //         await deleteFileFromCloudFlare(oldkey)
 //     }
 //     const updatedcompany =await CompanyPaymentToOwner.findByIdAndUpdate(
 //         _id,
 //         {
 //             paymentProof:paymentProofUrl
 //         },
 //         {
 //             returnDocument:"after",
 //             runValidators:true
 //         }
 //     )
 //     if (!updatedcompany) {
 //         throw new ApiError(404, "Payment record does not exist with the provided ID.");
 //     }
 //
 //    return  res
 //            .status(200)
 //            .json(new ApiResponse(200,updatedcompany,"Document Updated Succesfully"))
 //
 // }


 export {addPaymentHandler,viewAllPaymentHandler,updatePaymentdetailsHandler}
 // export {addPaymentHandler,viewAllPaymentHandler,updatePaymentdetailsHandler,updatedocumentHandler}