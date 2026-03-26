import mongoose, { Schema, Document } from "mongoose";

export interface IWorker extends Document {
    visaNumber: string;
    name: string;
    fatherName: string;
    contactNo: string[];
    passportNumber: string;
    passportIssueDate: Date;
    passportExpiryDate: Date;
    visaStampingDate: Date;
    biometricDate: Date;
    visaExpiry: Date;
    category: string;
    moneyPerHour: number;
    wpsPayment: number;
    dob: Date;
    departureDate: Date;
    companyName: string;
    empCode_id: string;
    dutyHour: number;
    is_Active: boolean;
    a?: string; // Consider renaming these later for clarity
    b?: string;
    c?: string;
    d?: string;
    e?: string;
    documents?: string; // 3rd party URL
}
const workerSchema = new Schema<IWorker>(
    {
        visaNumber: { type: String, required: [true, "Visa Number is required."], unique: true, trim: true },
        name: { type: String, required: [true, "Worker name is required."], trim: true },
        fatherName: { type: String, required: [true, "Father's name is required."] },
        contactNo: [{ type: String }],

        passportNumber: { type: String, required: [true, "Passport Number is required."], unique: true, trim: true },
        passportIssueDate: { type: Date, required: [true, "Passport Issue Date is required."] },
        passportExpiryDate: { type: Date, required: [true, "Passport Expiry Date is required."] },
        visaStampingDate: { type: Date },
        biometricDate: { type: Date },
        visaExpiry: { type: Date, required: [true, "Visa Expiry Date is required."] },
        category: { type: String, required: [true, "Worker category is required."] },
        moneyPerHour: {
            type: Number,
            required: [true, "Hourly rate is required."],
            min: [0, "Hourly rate cannot be negative."],
            default: 0
        },
        wpsPayment: {
            type: Number,
            min: [0, "WPS Payment cannot be negative."]
        },
        dob: { type: Date, required: [true, "Date of Birth is required."] },
        departureDate: { type: Date },
        companyName: { type: String },
        empCode_id: { type: String },
        dutyHour: {
            type: Number,
            min: [0, "Duty hours cannot be negative."],
            default: 0
        },
        is_Active: { type: Boolean, default: true },
        a: { type: String }, b: { type: String }, c: { type: String }, d: { type: String }, e: { type: String },
        documents: { type: String },
    },
    { timestamps: true }
);

export const Worker = mongoose.model<IWorker>("Worker", workerSchema);