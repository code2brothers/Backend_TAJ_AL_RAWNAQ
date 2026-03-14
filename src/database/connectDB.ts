import * as mongoose from "mongoose";// if not set esModuleInterop :true in tsconfig
import {DB_NAME} from "../constants.js";


const connectDB = async()=>{
  try {
      const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
      console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
  }catch(err){
  console.error(err);   
  }
}


export default connectDB;