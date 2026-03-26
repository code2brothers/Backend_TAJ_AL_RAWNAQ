import {Router} from "express";
import {sendEmailHandler} from "../controllers/contact.controller.js";

const router = Router()

router
    .route("/sendEmail")
    .get((_,res)=>{res.json("contact endpoint endpoint hit")})
    .post(sendEmailHandler)



export default router