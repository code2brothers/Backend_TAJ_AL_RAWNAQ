import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";
import {
    addPaymentHandler,
    updatePaymentdetailsHandler,
    viewAllPaymentHandler
} from "../controllers/companyPaymentToOwner_Monthly.js";
import {updateCompanydetailsHandler} from "../controllers/company.controller.js";



const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage toOwner endpoint hit")})

router.use(verifyAccess("MANAGE_PAYMENTS"))


router
    .route("/addPayment")
    .post(uploadOnCloudFlare.single("paymentProof"),addPaymentHandler)
router
    .route("/viewAllPayment")
    .get(viewAllPaymentHandler)


router.use(verifyAdmin)

router
    .route("/updatePaymentdetails")
    .patch(updatePaymentdetailsHandler)






export  default router