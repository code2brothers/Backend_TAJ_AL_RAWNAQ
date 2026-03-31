import {Response, Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {
    addDocumentsHandler,
    addNewCompanyHandler, deleteAdocumentHandler, updateCompanydetailsHandler,
    viewAllCompanyHandler, viewAllCompanywithName_IdHandler
} from "../controllers/company.controller.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";


const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage company endpoint hit")})

router.use(verifyAccess("MANAGE_COMPANY"))


router
    .route("/addNewCompany")
    .post(uploadOnCloudFlare.fields([{name: "documents"}, {name: "picture", maxCount: 1}]),addNewCompanyHandler)
router
    .route("/viewAllCompany")
    .get(viewAllCompanyHandler)
router
    .route("/viewAllWorkerwithName_Id")
    .get(viewAllCompanywithName_IdHandler)
router
    .route("/addCompanyDocuments")
    .post(uploadOnCloudFlare.array("documents"),addDocumentsHandler)

router.use(verifyAdmin)

router
    .route("/updateCompanydetails")
    .patch(uploadOnCloudFlare.single("picture"),updateCompanydetailsHandler)

router
    .route("/deleteAdocument")
    .patch(deleteAdocumentHandler)





export  default router