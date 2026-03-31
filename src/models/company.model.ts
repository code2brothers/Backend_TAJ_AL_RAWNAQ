import mongoose, { Schema, Document } from "mongoose";

interface ICompanyDocument {
    link: string;
    description: string;
    date: Date;
    // month: string;
    // year: string; // You can change this to 'number' if you prefer doing math on the year
}
export interface ICompany extends Document {
    registrationNo: string;
    companyName: string;
    phone: string;
    email: string;
    address: string;
    contactPerson: string;
    documents: ICompanyDocument[];
    picture?: string;
}

const companySchema = new Schema<ICompany>(
    {
        registrationNo: {
            type: String,
            required: [true, "Company Registration Number is required."],
            unique: true,
            trim: true
        },
        companyName: {
            type: String,
            required: [true, "Company Name is required."],
            trim: true
        },
        phone: {
            type: String,
            required: [true, "Company phone number is required."]
        },
        email: {
            type: String,
            required: [true, "Company email is required."],
            lowercase: true,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid company email address."]
        },
        address: {
            type: String,
            required: [true, "Company address is required."]
        },
        contactPerson: {
            type: String,
            required: [true, "Contact person name is required."]
        },
        picture: {
            type: String
        },
        documents: [
            {
                link: {
                    type: String,
                    required: [true, "Document link is required"]
                },
                description: {
                    type: String,
                    required: [true, "Document description is required"],
                    trim: true
                },
                date: {
                    type: String,
                    required: [true, "Date is required"]
                },
                // month: {
                //     type: String,
                //     required: [true, "Month is required"]
                // },
                // year: {
                //     type: String,
                //     required: [true, "Year is required"]
                // }
            }
        ],
    },
    { timestamps: true }
);

export const Company = mongoose.model<ICompany>("Company", companySchema);