import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {
    addNewWorkerHandler,
    updateWorkerdetailsHandler,
    viewAllWorkerHandler,
    viewOneWorkerHandler
} from "../controllers/worker.controller.js";

const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage worker endpoint hit")})

router.use(verifyAccess("MANAGE_WORKERS"))


router
    .route("/addNewWorker")
    .post(addNewWorkerHandler)
router
    .route("/viewAllWorker")
    .post(viewAllWorkerHandler)
router
    .route("/viewOneWorker")
    .post(viewOneWorkerHandler)

router.use(verifyAdmin)

router
    .route("/updateWorkerdetails")
    .post(updateWorkerdetailsHandler)


export  default router