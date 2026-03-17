import {Response,NextFunction} from "express";
import {AllowedActions, AuthRequest} from "../type/auth.interafce.js";
import {ApiError} from "../utils/ApiError.js";

const verifyAccess = (requiredSection:string) => {
    return (req:AuthRequest, res:Response, next:NextFunction) => {
        const user = req.user;

        if(!user){
            throw new ApiError(401,"user not found from auth middleware!")
        }
        // 1. GOD MODE: If Admin, let them pass instantly
        if (user.role === 'ADMIN') {
            return next();
        }

        // 2. CHECK BADGE: Do they have the specific permission?
        if (user.Permissions?.includes(requiredSection as AllowedActions)) {
            return next();
        }

        // 3. REJECT: Stop them right here
        throw new ApiError(403,"Access Denied: You do not have permission for this section.")
        };
};

const verifyAdmin =(req:AuthRequest, res:Response, next:NextFunction)=>{
    const user = req.user;
    if(!user){
        throw new ApiError(401,"user not found from auth middleware!")
    }
    if (user.role === 'ADMIN') {
        return next();
    }

    throw new ApiError(403,"Access Denied: You Can't access Update Route")
}


export {verifyAccess,verifyAdmin};

    //pass it only
    // ['COMPANY_OVERVIEW', 'MANAGE_WORKERS','MANAGE_EMPLOYEES',  'MANAGE_PAYMENTS','MANAGE_COMPANY']