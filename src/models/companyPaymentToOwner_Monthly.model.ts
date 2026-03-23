import mongoose, { Schema, Document } from "mongoose";

export interface ICompanyPaymentToOwner extends Document {
    amount: number;
    dateofPayment: Date;
    paymentProof: string; // 3rd party URL
    company_id: mongoose.Types.ObjectId; // Relationship to Company
    month: string;
    year: string;
    paymentMode: "Cheque" | "Bank Transfer" | "Cash"|"UPI";
    transactionId: string;
    remarks?: string;
    dataEnteredBY: mongoose.Types.ObjectId; // Relationship to User
}

const companyPaymentToOwnerSchema = new Schema<ICompanyPaymentToOwner>(
    {

        amount: {
            type: Number,
            required: [true, "Payment amount is required."],
            min: [0, "Payment amount cannot be negative."]
        },
        dateofPayment: { type: Date, required: [true, "Payment date is required."] },
        paymentProof: { type: String },
        company_id: { type: Schema.Types.ObjectId, ref: "Company", required: [true, "Company ID is required."] },
        month: { type: String, required: [true, "Month is required."] },
        year: { type: String, required: [true, "Year is required."] },
        paymentMode: {
            type: String,
            enum: {
                values: ["Cheque", "Bank Transfer", "Cash"],
                message: "{VALUE} is not a valid payment mode. Use Cheque, Bank Transfer, or Cash."
            },
            required: [true, "Payment mode is required."]
        },
        transactionId: { type: String, required: [true, "Transaction ID is required."] },
        remarks: { type: String },
        dataEnteredBY: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
);

export const CompanyPaymentToOwner = mongoose.model<ICompanyPaymentToOwner>(
    "CompanyPaymentToOwner",
    companyPaymentToOwnerSchema
);