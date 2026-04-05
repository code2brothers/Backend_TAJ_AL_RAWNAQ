import {Router} from "express";
import {verifyJwt} from "../middleware/auth.middleware.js";
import {
    currentUserHandler,
    loginHandler,
    logoutHandler,
    refreshAccessTokenHandler
} from "../controllers/user.controller.js";

const router = Router()

router
    .route("/login")
    .post(loginHandler)

router
    .route("/refreshAccessToken")
    .post(refreshAccessTokenHandler)

router.use(verifyJwt)
// below it all routes are protected , above not
router
    .route("/logout")
    .post(logoutHandler)

router
    .route("/currentUser")
    .get(currentUserHandler)


export default router