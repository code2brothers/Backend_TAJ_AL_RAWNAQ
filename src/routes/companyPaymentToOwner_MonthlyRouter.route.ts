import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";
import {
    addPaymentHandler,
    updatePaymentdetailsHandler,
    viewAllPaymentHandler
} from "../controllers/companyPaymentToOwner_Monthly.controller.js";



const router = Router()

router.use(verifyAccess("MANAGE_PAYMENTS"))


router
    .route("/addPayment")
    .post(uploadOnCloudFlare.single("document"),addPaymentHandler)

router
    .route("/viewAllPayment")
    .get(viewAllPaymentHandler)


router.use(verifyAdmin)

router
    .route("/updatePaymentdetails")
    .patch(uploadOnCloudFlare.single("document"),updatePaymentdetailsHandler)

export  default router