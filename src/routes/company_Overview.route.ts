import { Router} from "express";
import {verifyAccess} from "../middleware/verifyAccess.middleware.js";
import {company_OverviewHandler} from "../controllers/company_Overview.controller.js";


const router = Router()

router.use(verifyAccess("COMPANY_OVERVIEW"))


router
    .route("/")
    .get(company_OverviewHandler)


export  default router