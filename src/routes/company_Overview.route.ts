import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {updateWorkerdetailsHandler} from "../controllers/worker.controller.js";
import {company_OverviewHandler} from "../controllers/company_Overview.controller.js";


const router = Router()


router.use(verifyAccess("COMPANY_OVERVIEW"))


router
    .route("/")
    .get(company_OverviewHandler)


export  default router