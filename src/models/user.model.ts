import {Schema, model, Document, Model} from "mongoose"
import jwt from "jsonwebtoken";
import {NextFunction} from "express";
import bcrypt from "bcrypt"
const cleanTransform = (doc: any, ret: any) => {
    // ret.id = ret._id;
    // delete ret._id;
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
};
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "EMPLOYEE";
    Permissions: (
        | "COMPANY_OVERVIEW"
        | "MANAGE_WORKERS"
        | "MANAGE_EMPLOYEES"
        | "MANAGE_PAYMENTS"
        | "MANAGE_COMPANY"
        )[];
    is_Active: boolean;
    picture?: string;
    refreshToken?: string;
    // Note: 'id', 'createdAt', and 'updatedAt' are handled automatically by Mongoose
}
export interface IUserMethods {
    isPasswordCorrect(password: string): Promise<boolean>;
    generateAccessToken(): string;
    generateRefreshToken(): string;
}

type UserModel = Model<IUser, {}, IUserMethods>;



const userSchema = new Schema<IUser, UserModel, IUserMethods>({
    name: {
        type: String,
        required: [true, "Name is required!"], // Custom message
        trim: true,
        maxlength: [50, "Name cannot exceed 50 characters."]
    },
    email: {
        type: String,
        required: [true, "Email address is required."],
        unique: true,
        lowercase: true,
        trim: true,
        // The Regex checks for standard email formatting (user@domain.com)
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            "Please provide a valid email address." // Custom message if Regex fails
        ]
    },
    password: {
        type: String,
        required: [true, "Password is required."]
    },
    role: {
        type: String,
        enum: {
            values: ["ADMIN", "EMPLOYEE"],
            message: "{VALUE} is not a valid role. Choose ADMIN or EMPLOYEE."
        },
        required: true,
        default: "EMPLOYEE", // Safety default
    },
    Permissions: [
        {
            type: String,
            enum: [
                "COMPANY_OVERVIEW",
                "MANAGE_WORKERS",
                "MANAGE_EMPLOYEES",
                "MANAGE_PAYMENTS",
                "MANAGE_COMPANY",
            ],
        },
    ],
    is_Active: {
        type: Boolean,
        default: true // Users are active by default when created
    },
    picture: {
        type: String
    },
    refreshToken: {
        type: String
    },
},{timestamps:true,
   //  here after timestamps you can define all methods but either define all or none
   // methods:{
   //  isPasswordCorrect(password:string):boolean{
   //  return (this.password === password)
   //   }
// }
    toJSON: {
        transform: cleanTransform,
    },
    toObject:{
    transform:cleanTransform,
    }
})

userSchema.methods.isPasswordCorrect = async function(password:string){
    return await bcrypt.compare(password, this.password)

}

userSchema.methods.generateAccessToken=function (){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email
        },
        process.env.ACCESS_TOKEN_SECRET!,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY as any
        }
    )
}
userSchema.methods.generateRefreshToken =function (){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email
        },
        process.env.REFRESH_TOKEN_SECRET!,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY as any
        }
    )
}
userSchema.pre("save", async function () {
    if(!this.isModified("password")) return ;

    this.password = await bcrypt.hash(this.password, 10)

})

export const User = model<IUser, UserModel>("User",userSchema)