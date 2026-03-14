import { Response, NextFunction } from "express"; // Import these instead of RequestHandler
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { CustomJwtPayload, AuthRequest } from "../type/auth.interafce.js"; // Import AuthRequest

const  {TokenExpiredError} = jwt

const verifyJwt = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized access");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token.");
        }

        if(!user.is_Active){
            throw new ApiError(401, "You are deactivated.");
        }

        req.user = user;
        next();
    } catch (error: unknown) {
        if (error instanceof TokenExpiredError) {
            throw new ApiError(427, 'Access Token Expired');
        }
        if (error instanceof Error) {
            throw new ApiError(401, error.message || 'Unauthorized access');
        }
        throw new ApiError(401, 'Unauthorized access');
    }
}

export { verifyJwt };
