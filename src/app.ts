import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorHandler } from "./utils/ErrorHandler.js";
import { verifyJwt } from "./middleware/auth.middleware.js";
import testingRoute from "./routes/testing.route.js";
import userRouter from "./routes/user.route.js"
import employeeRouter from "./routes/employee.route.js"
import workerRouter from "./routes/worker.route.js"
import companyRouter from "./routes/company.route.js"
import companyPaymentToOwner_MonthlyRouter from "./routes/companyPaymentToOwner_MonthlyRouter.route.js"
import CompanyExpenditureRouter from "./routes/companyExpenditure.route.js"
import ownerPaymentToWorker_MonthlyRouter from "./routes/ownerPaymentToWorker_MonthlyRouter.route.js"
import company_OverviewRouter from "./routes/company_Overview.route.js"
import contactRouter from "./routes/contact.router.js";

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || "https://taj-al-rawnaqqqw.vercel.app",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(cookieParser())
app.use(express.static("public"))




// ALL ROUTES
app.use("/api/v1/testing", testingRoute)
app.use("/api/v1/user", userRouter)
app.use("/api/v1/contact", contactRouter)

app.use(verifyJwt)

app.use("/api/v1/employee", employeeRouter)
app.use("/api/v1/worker", workerRouter)
app.use("/api/v1/company", companyRouter)
app.use("/api/v1/companyPaymentToOwner_Monthly", companyPaymentToOwner_MonthlyRouter)
app.use("/api/v1/companyExpenditure", CompanyExpenditureRouter)
app.use("/api/v1/ownerPaymentToWorker_Monthly", ownerPaymentToWorker_MonthlyRouter)
app.use("/api/v1/company_Overview", company_OverviewRouter)

app.use(ErrorHandler)
export { app }