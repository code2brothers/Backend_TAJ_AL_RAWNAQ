import {AuthRequest} from "../type/auth.interafce.js";
import {Response} from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const company_OverviewHandler=(req: AuthRequest, res: Response)=>{
//  fetches all payments by month ,year for showing   profit and loss, we send array
    res.status(200).json(new ApiResponse(200,"succesfully reach here"))
}

export {company_OverviewHandler}