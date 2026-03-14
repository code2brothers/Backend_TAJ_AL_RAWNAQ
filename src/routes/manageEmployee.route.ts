import {Router} from "express";
import {AuthRequest} from "../type/auth.interafce.js";
import {Response} from "express";
import {
    addNewEmployeeHandler, updateEmployeedetailsHandler,
    viewAllEmployeeHandler
} from "../controllers/employee.controller.js";
import {IsAdmin, verifyAccess} from "../middleware/verifyAccess.middleware.js";

const router = Router()

router
    .route("/")
    .get((req:AuthRequest,res:Response)=>{res.json("manage employee endpoint hit")})

router.use(verifyAccess("MANAGE_EMPLOYEES"))


router
    .route("/addNewEmployee")
    .post(addNewEmployeeHandler)
router
    .route("/viewAllEmployee")
    .get(viewAllEmployeeHandler)


router.use(IsAdmin)
router
    .route("/updateEmployeeDetails")
    .patch(updateEmployeedetailsHandler)


export default router
