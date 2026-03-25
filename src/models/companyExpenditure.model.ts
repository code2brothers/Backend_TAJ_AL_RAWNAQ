import mongoose, { Schema, Document } from "mongoose";

export interface ICompanyExpenditure extends Document {
    amount: number;
    paymentProof: string; // 3rd party URL
    purpose: string;
    dateofPayment: Date;
    month: string;
    year: string;
    paymentMode: "Cheque" | "Bank Transfer" | "Cash"|"UPI";
    transactionId: string;
    remarks?: string;
    dataEnteredBY: mongoose.Types.ObjectId; // Relationship to User
}

const companyExpenditureSchema = new Schema<ICompanyExpenditure>(
    {
        amount: {
            type: Number,
            required: [true, "Expenditure amount is required."],
            min: [0, "Expenditure amount cannot be negative."]
        },
        paymentProof: { type: String },

        purpose: { type: String, required: [true, "Purpose of expenditure is required."] },
        dateofPayment: { type: Date, required: [true, "Payment date is required."] },
        month: { type: String, required: [true, "Month is required."] },
        year: { type: String, required: [true, "Year is required."] },
        paymentMode: {
            type: String,
            enum: {
                values: ["Cheque", "Bank Transfer", "Cash","UPI"],
                message: "{VALUE} is not a valid payment mode. Use Cheque, Bank Transfer,Upi, or Cash."
            },
            required: [true, "Payment mode is required."]
        },
        transactionId: { type: String, required: [true, "Transaction ID is required."] },
        remarks: { type: String },
        dataEnteredBY: { type: Schema.Types.ObjectId, ref: "User", required: [true, "User ID tracking is required."] },
    },
    { timestamps: true }
);

export const CompanyExpenditure = mongoose.model<ICompanyExpenditure>(
    "CompanyExpenditure",
    companyExpenditureSchema
);