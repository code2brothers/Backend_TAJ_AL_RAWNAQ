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

const router = Router()


router.use(verifyAccess("MANAGE_WORKERS"))


router
    .route("/addNewWorker")
    .post(uploadOnCloudFlare.fields([{name: "documents", maxCount: 1}, {name: "picture", maxCount: 1}]),addNewWorkerHandler)
router
    .route("/viewAllWorker")
    .get(viewAllWorkerHandler)
router
    .route("/viewOneWorker")
    .get(viewOneWorkerHandler)

router.use(verifyAdmin)

router
    .route("/updateWorkerdetails")
    .patch(uploadOnCloudFlare.fields([{name: "newdocument", maxCount: 1}, {name: "picture", maxCount: 1}]),updateWorkerdetailsHandler)


export  default router