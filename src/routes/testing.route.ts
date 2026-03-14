import {Router} from "express";
import {testing} from "../controllers/testing.controller.js";
import {uploadOnCloudFlare} from "../middleware/uploadonCloudFlare.middleware.js";

const router = Router()

// FOR SINGLE FILE
router
    .route("/")
    .post(uploadOnCloudFlare.single("testingasset"),testing)
    .get((req,res)=>{
       
        return res.json("testing endpoint hit")
    })
//FOR MULTIPLES  FILES (upload.array("incomngfilename", max_limit(like=20) or .fields([ { name: 'avatar' }, { name: 'resume' } ]) but both handles differently )
//     .array -> [ { originalname: 'a.jpg' }, { originalname: 'b.jpg' } ]
//     .fields -> {
//      avatar: [ { originalname: 'me.jpg' } ],
//      resume: [ { originalname: 'cv.pdf' } ]
//     }
// ---------------------------------------------------------------------------------------------------------------------
// router
//     .route("/")
//     .post(uploadOnCloudFlare.array("testingasset",10),testing)
//     .get((req,res)=>{
//         return res.json("Working.....")
//     })



export default router