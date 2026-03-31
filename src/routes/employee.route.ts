import {Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {Response} from "express";
import {
    addNewEmployeeHandler, updateEmployeedetailsHandler,
    viewAllEmployeeHandler
} from "../controllers/employee.controller.js";
import { verifyAccess, verifyAdmin} from "../middleware/verifyAccess.middleware.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";

const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage employee endpoint hit")})

router.use(verifyAccess("MANAGE_EMPLOYEES"))


router
    .route("/addNewEmployee")
    .post(uploadOnCloudFlare.single("picture"),addNewEmployeeHandler)
router
    .route("/viewAllEmployee")
    .get(viewAllEmployeeHandler)


router.use(verifyAdmin)
router
    .route("/updateEmployeeDetails")
    .patch(uploadOnCloudFlare.single("picture"),updateEmployeedetailsHandler)


export default router
