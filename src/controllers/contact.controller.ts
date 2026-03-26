import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import nodemailer from "nodemailer";

const sendEmailHandler = async (req: AuthRequest, res: Response) => {
    const { Name, Email, Phone, Company_Name, message } = req.body;

    if (!Name || !Email || !Phone || !message) {
        throw new ApiError(
            400,
            "Please provide your Name, Email, Phone, and a Message."
        );
    }

    try {
        // Create the email transporter using your Gmail credentials
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SENDER, // e.g., "yourcompany@gmail.com"
                pass: process.env.SENDER_PASS, // IMPORTANT: This must be an "App Password", not your login password!
            },
        });

        const submissionTime = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        });

        // Format a professional looking HTML email
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
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">New System Inquiry</h1>
                            <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">BitCare / Manpower Management System</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #475569;">
                                Hello Admin,<br><br>
                                A new contact form submission has been received. Here are the details of the prospect:
                            </p>

                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b; width: 35%;">Full Name</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; color: #334155;">${Name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">Email Address</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0;">
                                        <a href="mailto:${Email}" style="color: #2563eb; text-decoration: none;">${Email}</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">Phone Number</td>
                                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; color: #334155;">${Phone}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px; font-weight: 600; color: #1e293b;">Company</td>
                                    <td style="padding: 15px; color: #334155;">${Company_Name || "<span style='color: #94a3b8; font-style: italic;'>Not Provided</span>"}</td>
                                </tr>
                            </table>

                            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Message Content</h3>
                            <div style="background-color: #ffffff; border-left: 4px solid #3b82f6; padding: 15px 20px; font-size: 15px; line-height: 1.6; color: #334155; border-radius: 0 6px 6px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                ${message.replace(/\n/g, "<br>")}
                            </div>
                            
                            <div style="margin-top: 35px; text-align: center;">
                                <a href="mailto:${Email}" style="background-color: #2563eb; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">Reply to ${Name}</a>
                            </div>

                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 13px; color: #64748b;">
                                This is an automated message generated by your backend system.<br>
                                Submitted on: <strong>${submissionTime}</strong>
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

        // Define who the email is going to and what it says
        const mailOptions = {
            from: process.env.SENDER,
            to: process.env.RECIEVER, // The email address where YOU want to receive these messages
            subject: `New Inquiry from ${Name} - ${Company_Name || "Independent"}`,
            html: htmlTemplate,
            replyTo: process.env.SENDER, // If you hit "Reply" in Gmail, it goes straight to the customer!
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    null,
                    "Your message has been sent successfully!"
                )
            );
    } catch (error: any) {
        console.error("Nodemailer Error:", error);
        throw new ApiError(
            500,
            "Failed to send email. Please try again later."
        );
    }
};

export { sendEmailHandler };
