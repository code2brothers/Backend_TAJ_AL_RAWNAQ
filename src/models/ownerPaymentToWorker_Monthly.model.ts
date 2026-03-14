import mongoose, { Schema, Document } from "mongoose";

export interface IOwnerPaymentToWorker extends Document {
    worker_id: mongoose.Types.ObjectId; // Relationship to Worker
    dateofPayment: Date;
    transactionId: string;
    month: string;
    year: string;
    totalHours: number;
    hourRateFromCompany: number;
    hourRateToWorker: number;
    payment_proof: string;
    companyName: string;
    dataEnteredBY: mongoose.Types.ObjectId; // Relationship to User
}

const ownerPaymentToWorkerSchema = new Schema<IOwnerPaymentToWorker>(
    {
        worker_id: { type: Schema.Types.ObjectId, ref: "Worker", required: [true, "Worker ID is required."] },
        dateofPayment: { type: Date, required: [true, "Payment date is required."] },
        transactionId: { type: String, required: [true, "Transaction ID is required."] },
        month: { type: String, required: [true, "Payment month is required."] },
        year: { type: String, required: [true, "Payment year is required."] },
        totalHours: {
            type: Number,
            required: [true, "Total hours are required."],
            min: [0, "Total hours cannot be negative."]
        },
        hourRateFromCompany: {
            type: Number,
            required: [true, "Company hourly rate is required."],
            min: [0, "Rate cannot be negative."]
        },
        hourRateToWorker: {
            type: Number,
            required: [true, "Worker hourly rate is required."],
            min: [0, "Rate cannot be negative."]
        },
        payment_proof: { type: String },
        companyName: { type: String, required: [true, "Company name is required."] },
        dataEnteredBY: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
);

export const OwnerPaymentToWorker = mongoose.model<IOwnerPaymentToWorker>(
    "OwnerPaymentToWorker",
    ownerPaymentToWorkerSchema
);