import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";
import { User } from "../models/user.model.js";


export interface CustomJwtPayload extends JwtPayload {
    _id: string;
    email: string;
}

// Define the Request used in protected routes
// Using 'InstanceType<typeof User>' ensures req.user has all Mongoose methods
export interface AuthRequest extends Request {
    user?: InstanceType<typeof User>;
}





export type AllowedActions = "COMPANY_OVERVIEW" | "MANAGE_WORKERS" | "MANAGE_EMPLOYEES" | "MANAGE_PAYMENTS" | "MANAGE_COMPANY";

