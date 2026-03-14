import { Request, Response,NextFunction} from "express";

const ErrorHandler =(err:any,req:Request,res:Response,next:NextFunction)=>{
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const errors = err.errors || [];

    res.status(statusCode).json({
        statusCode,
        message,
        errors,
        data: null,
        success: false,
    });
}


export {ErrorHandler}