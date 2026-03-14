import {RequestHandler,Response} from "express";
import {User} from "../models/user.model.js";
import {ApiError} from "../utils/ApiError.js";
import {model, Schema, Types} from "mongoose";
import {options} from "../constants.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {AuthRequest, CustomJwtPayload} from "../type/auth.interafce.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens =async(userId:string|Types.ObjectId)=>{
          try{
              const user = await  User.findById(userId)
              if(!user){
                  throw new ApiError(404,"User does not exist ")
              }
              const accessToken = await user.generateAccessToken()
              const refreshToken = await user.generateRefreshToken()

              user.refreshToken= refreshToken;
              await user.save({validateBeforeSave: false})

              return {accessToken,refreshToken}

          }catch (error){
              throw new ApiError(500, "Something went wrong while generating referesh and access token")
          }
}



const loginHandler:RequestHandler =async(req,res)=>{
    const {email,password}=req.body
    if(!email ||!password){
        throw new ApiError(400," email or password is missing")
    }
    const user = await User.findOne({email})

    if(!user){
        throw new ApiError(404,"User does not exist ")
    }

    if(!user.is_Active){
        throw new ApiError(401, "You are deactivated");
    }

   const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user Credentials")
    }


    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // const loginUser = await  User.findById(user._id).select("-password refreshToken")
    const loginUser = await  User.findById(user._id)

    return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json( new ApiResponse(200,{user:loginUser,accessToken,refreshToken},"User logged In Successfully"))

}


const logoutHandler=async(req:AuthRequest,res:Response)=>{
    await User.findByIdAndUpdate(
        req.user!._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            returnDocument:"after"
        }
    )

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
}


const currentUserHandler = (req:AuthRequest,res:Response)=>{
    return res
        .status(200)
        .json(new ApiResponse(200,req.user,"current user fetched succesfully! "))
}

const refreshAccessTokenHandler = async (req:AuthRequest,res:Response)=> {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET!) as CustomJwtPayload;

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")

        }


        const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken},
                    "Access token refreshed"
                )
            )
    } catch (error) {
        if (error instanceof Error) {
            throw new ApiError(401, error.message || "Invalid refresh token");
        }

        throw new ApiError(401, "Invalid refresh token");
    }
}





export {loginHandler,logoutHandler,currentUserHandler,refreshAccessTokenHandler}


