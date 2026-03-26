import { AuthRequest } from "../type/auth.interafce.js";
import { Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import nodemailer from "nodemailer"


const sendEmailHandler = async (req: AuthRequest, res: Response) => {
    // 1. Extract data
    const { Name, Email, Phone, Company_Name, message } = req.body;

    // ==========================================
    // 2. EARLY VALIDATION
    // ==========================================
    if (!Name || !Email || !Phone || !message) {
        throw new ApiError(400, "Please provide your Name, Email, Phone, and a Message.");
    }

    // ==========================================
    // 3. MAIN EXECUTION BLOCK (Try...Catch)
    // ==========================================
    try {
        // Create the email transporter using your Gmail credentials
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER, // e.g., "yourcompany@gmail.com"
                pass: process.env.EMAIL_PASS  // IMPORTANT: This must be an "App Password", not your login password!
            },
        });

        // Format a professional looking HTML email
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #0056b3;">New Contact Inquiry</h2>
                <p>You have received a new message from your system's contact form.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 30%;">Name:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${Email}">${Email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Phone}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Company:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Company_Name || "N/A"}</td>
                    </tr>
                </table>

                <h3 style="margin-top: 20px;">Message:</h3>
                <div style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #0056b3;">
                    ${message.replace(/\n/g, "<br>")} 
                </div>
            </div>
        `;

        // Define who the email is going to and what it says
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // The email address where YOU want to receive these messages
            subject: `New Inquiry from ${Name} - ${Company_Name || "Independent"}`,
            html: htmlTemplate,
            replyTo: Email // If you hit "Reply" in Gmail, it goes straight to the customer!
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        return res
            .status(200)
            .json(new ApiResponse(200, null, "Your message has been sent successfully!"));

    } catch (error: any) {
        console.error("Nodemailer Error:", error);
        throw new ApiError(500, "Failed to send email. Please try again later.");
    }
};

export {sendEmailHandler}