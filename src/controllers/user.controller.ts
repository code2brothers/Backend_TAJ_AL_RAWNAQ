import { RequestHandler, Response } from "express";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { model, Schema, Types } from "mongoose";
import { options } from "../constants.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { AuthRequest, CustomJwtPayload } from "../type/auth.interafce.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

const generateAccessAndRefereshTokens = async (userId: string | Types.ObjectId) => {
    try {
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "User does not exist ")
        }
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}



const loginHandler: RequestHandler = async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        throw new ApiError(400, " email or password is missing")
    }
    const user = await User.findOne({ email }).select('+password')
    if (!user) {
        throw new ApiError(404, "User does not exist ")
    }

    if (!user.is_Active) {
        throw new ApiError(401, "You are deactivated");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user Credentials")
    }
    if (user.resetPasswordToken || user.resetPasswordExpire) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
    }
    await user.save({ validateBeforeSave: false })

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)


    const loginUser = await User.findById(user._id)

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, { user: loginUser, accessToken, refreshToken }, "User logged In Successfully"))

}


const logoutHandler = async (req: AuthRequest, res: Response) => {
    await User.findByIdAndUpdate(
        req.user!._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            returnDocument: "after"
        }
    )

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"))
}


const currentUserHandler = (req: AuthRequest, res: Response) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched succesfully! "))
}

const refreshAccessTokenHandler = async (req: AuthRequest, res: Response) => {
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


        const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
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

const forgotPasswordHandler = async (req: AuthRequest, res: Response) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Please provide your email address.");
    }

    // 1. Find the user
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "There is no user registered with that email address.");
    }

    // 2. Get the unhashed token (Make sure getResetPasswordToken() is in your User schema!)
    const resetToken = user.getResetPasswordToken();

    // 3. Save the hashed token to the DB
    // We pass { validateBeforeSave: false } so we don't trigger other required field errors
    await user.save({ validateBeforeSave: false });

    // 4. Create the URL for your React frontend
    // Ensure FRONTEND_URL is in your .env (e.g., http://localhost:3000)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // 5. Send the Email
    try {
        // Create the email transporter using your exact config
        const transporter = nodemailer.createTransport({
            host: "smtp.zoho.in", // or smtp.zoho.com depending on your region
            port: 465,
            secure: true,
            auth: {
                user: process.env.SENDER2, // e.g., "yourcompany@gmail.com"
                pass: process.env.SENDER_PASS2, // Must be the 16-character App Password from Zoho Security settings
            }
        });

        // Format a professional looking HTML email matching your "Taj Al Rawnaq" theme
        const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    
                    <tr>
                        <td style="background-color: #0f172a; padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Password Reset</h1>
                            <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">Taj Al Rawnaq</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #475569;">
                                Hello ${user.name || "User"},<br><br>
                                We received a request to reset the password for your account. Please click the button below to securely set a new password:
                            </p>

                            <div style="margin-top: 35px; margin-bottom: 35px; text-align: center;">
                                <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">Reset My Password</a>
                            </div>

                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #64748b;">
                                Or copy and paste this link directly into your browser:<br>
                                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                            </p>
                            
                            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #ef4444; font-weight: 600;">
                                For your security, this link will expire in exactly 15 minutes.
                            </p>

                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 13px; color: #64748b;">
                                If you did not request a password reset, please ignore this email. Your account remains completely secure.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

        // Configure the email options
        const mailOptions = {
            from: process.env.SENDER2,
            to: user.email, // Send to the specific user who requested the reset
            subject: `Password Reset Request - Taj Al Rawnaq`,
            html: htmlTemplate,
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        return res
            .status(200)
            .json(new ApiResponse(200, null, "Password reset token sent to your email!"));

    } catch (error: any) {
        console.error("Nodemailer Error:", error);

        // FAILSAFE: If the email fails, we must remove the token from the database
        // so the user isn't locked out of trying again!
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });

        throw new ApiError(500, "Failed to send reset email. Please try again later.");
    }
}




const resetPasswordHandler = async (req: AuthRequest, res: Response) => {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (typeof token !== 'string') {
        // Handle the error or return a 400 response
        throw new ApiError(400, "Invalid token format");
    }
    // 2. Hash the token from the URL so we can compare it to the database
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // 3. Find the user based on the hashed token AND ensure it hasn't expired
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: new Date() } // $gt means "Greater Than" right now
    });

    if (!user) {
        throw new ApiError(400, "Token is invalid or has expired");
    }

    // 4. Set the new password (This is why we used .save() earlier!)
    user.password = newPassword;

    // 5. Clean up the database (remove the used tokens)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // 6. Save! (Your bcrypt pre('save') hook catches the new password right here!)
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, "Password has been successfully reset!"));

}




export { loginHandler, logoutHandler, currentUserHandler, refreshAccessTokenHandler, forgotPasswordHandler, resetPasswordHandler }


