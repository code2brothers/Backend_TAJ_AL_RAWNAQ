import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {
    addNewWorkerHandler,
    updateWorkerdetailsHandler,
    viewAllWorkerHandler,
    viewOneWorkerHandler
} from "../controllers/worker.controller.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";
// import {updatedocumentHandler} from "../controllers/worker.controller.js";

const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage worker endpoint hit")})

router.use(verifyAccess("MANAGE_WORKERS"))


router
    .route("/addNewWorker")
    .post(uploadOnCloudFlare.single("documents"),addNewWorkerHandler)
router
    .route("/viewAllWorker")
    .get(viewAllWorkerHandler)
router
    .route("/viewOneWorker/:passportNumber")
    .get(viewOneWorkerHandler)

router.use(verifyAdmin)

router
    .route("/updateWorkerdetails")
    .patch(uploadOnCloudFlare.single("newdocument"),updateWorkerdetailsHandler)
// router
//     .route("/updatedocument")
//     .patch(uploadOnCloudFlare.single("newdocument"),updatedocumentHandler)


export  default router