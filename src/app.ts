import express, {urlencoded} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {ErrorHandler} from "./utils/ErrorHandler.js";
import {verifyJwt} from "./middleware/auth.middleware.js";
import testingRoute from "./routes/testing.route.js";
import userRouter from "./routes/user.route.js"
import employeeRouter from "./routes/employee.route.js"
import workerRouter from "./routes/worker.route.js"
import companyRouter  from "./routes/company.route.js"

const app = express();
app.use(express.json({limit:"16kb"}))
app.use(cors())
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(cookieParser())
app.use(express.static("public"))




// ALL ROUTES
app.use("/api/v1/testing",testingRoute)
app.use("/api/v1/user",userRouter)

app.use(verifyJwt)

app.use("/api/v1/employee",employeeRouter)
app.use("/api/v1/worker",workerRouter)
app.use("/api/v1/company",companyRouter)


app.use(ErrorHandler)
export {app}